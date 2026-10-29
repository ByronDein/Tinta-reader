-- Tinta Reader: esquema de sincronización (opcional).
-- Pégalo completo en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.
-- Cada usuario solo puede ver y modificar sus propias filas y archivos (RLS).

-- Libros -----------------------------------------------------------------
create table if not exists public.books (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  id         text    not null,
  title      text    not null default '',
  author     text,
  size       bigint  not null default 0,
  page_count int     not null default 0,
  added_at   bigint  not null default 0,
  has_file   boolean not null default false,
  deleted    boolean not null default false,
  updated_at bigint  not null default 0,
  primary key (user_id, id)
);

-- Progreso de lectura ------------------------------------------------------
create table if not exists public.progress (
  user_id     uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  book_id     text   not null,
  mode        text   not null default 'reflow',
  block_index int    not null default 0,
  char_offset int    not null default 0,
  pdf_page    int    not null default 1,
  percent     double precision not null default 0,
  updated_at  bigint not null default 0,
  primary key (user_id, book_id)
);

-- Marcadores, subrayados y notas ---------------------------------------------
create table if not exists public.annotations (
  user_id    uuid    not null default auth.uid() references auth.users (id) on delete cascade,
  id         text    not null,
  book_id    text    not null,
  data       jsonb   not null default '{}'::jsonb,
  deleted    boolean not null default false,
  updated_at bigint  not null default 0,
  primary key (user_id, id),
  constraint annotations_data_size check (octet_length(data::text) < 100000)
);
create index if not exists annotations_book_idx on public.annotations (user_id, book_id);

-- Ajustes de lectura ("global" o id de libro) -----------------------------------
create table if not exists public.settings (
  user_id    uuid   not null default auth.uid() references auth.users (id) on delete cascade,
  key        text   not null,
  value      jsonb  not null default '{}'::jsonb,
  updated_at bigint not null default 0,
  primary key (user_id, key),
  constraint settings_value_size check (octet_length(value::text) < 20000)
);

-- Seguridad por filas -------------------------------------------------------
alter table public.books       enable row level security;
alter table public.progress    enable row level security;
alter table public.annotations enable row level security;
alter table public.settings    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['books', 'progress', 'annotations', 'settings'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Archivos PDF (bucket privado, una carpeta por usuario: <user_id>/<id>.pdf) --------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('books', 'books', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/pdf'];

drop policy if exists "books select own" on storage.objects;
drop policy if exists "books insert own" on storage.objects;
drop policy if exists "books delete own" on storage.objects;

create policy "books select own" on storage.objects for select to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "books insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'books' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "books delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'books' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Borrar la propia cuenta (la app borra antes los archivos con la API de Storage) --------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
