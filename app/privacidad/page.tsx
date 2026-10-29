import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Política de privacidad · Tinta Reader" };

const contact = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export default function Privacidad() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 leading-relaxed">
      <Link href="/" className="text-sm underline">
        ← Volver
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Política de privacidad</h1>
      <p className="mt-2 text-sm text-muted">Tinta Reader es un proyecto personal, gratuito y sin publicidad.</p>

      <h2 className="mt-8 text-xl font-semibold">Sin cuenta</h2>
      <p className="mt-2">
        Si no inicias sesión, todo (tus PDF, el texto extraído, el progreso, las notas y los ajustes) se guarda solo en el
        navegador de tu dispositivo (IndexedDB). Tus libros no se envían a ningún servidor (solo las consultas de diccionario, ver abajo). La app no usa analytics, cookies de
        seguimiento ni publicidad.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Diccionario y traducción</h2>
      <p className="mt-2">
        Al pulsar «Significado» sobre un texto seleccionado, ese texto (solo la palabra o frase seleccionada, nunca el libro
        ni tu cuenta) se envía a servicios externos de diccionario y traducción: Free Dictionary API, Wiktionary
        (Wikimedia) y MyMemory. Los resultados se guardan en tu dispositivo para poder verlos de nuevo sin conexión. Tu lista
        de vocabulario se guarda solo en tu dispositivo.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Con cuenta (sincronización opcional)</h2>
      <p className="mt-2">Si decides iniciar sesión para continuar la lectura en otro dispositivo, se guardan en tu cuenta:</p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        <li>Tu correo electrónico (para iniciar sesión con un código).</li>
        <li>Los PDF que tengas en tu biblioteca (de hasta 50 MB cada uno), en un espacio privado solo accesible por tu cuenta.</li>
        <li>El título, autor y tamaño de cada libro, tu progreso de lectura, marcadores, subrayados, notas y ajustes de lectura.</li>
      </ul>
      <p className="mt-2">
        Estos datos se usan únicamente para sincronizar tu biblioteca entre tus dispositivos. No se venden, no se comparten con
        terceros ni se usan para publicidad o perfiles. No se lee el contenido de tus libros.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Dónde se guardan</h2>
      <p className="mt-2">
        La sincronización usa Supabase como proveedor de base de datos, almacenamiento y autenticación, y el sitio se
        sirve con Vercel. Esto implica que tus datos pueden tratarse en servidores fuera de Chile. Cada usuario solo puede
        acceder a sus propios datos (seguridad por filas y carpeta privada por usuario).
      </p>

      <h2 className="mt-8 text-xl font-semibold">Tus derechos</h2>
      <p className="mt-2">
        Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición y portabilidad directamente desde la app, en
        el panel de la nube (icono de nube de la biblioteca):
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        <li>
          <strong>Exportar mis datos:</strong> descarga un archivo JSON con tu progreso, notas, marcadores y ajustes.
        </li>
        <li>
          <strong>Cerrar sesión:</strong> deja de sincronizar; tus libros siguen en el dispositivo.
        </li>
        <li>
          <strong>Borrar mi cuenta y mis datos en la nube:</strong> elimina de forma definitiva tu cuenta, los PDF subidos y
          todo lo sincronizado. Los datos guardados en tu dispositivo se conservan hasta que los borres desde el navegador.
        </li>
      </ul>
      {contact && (
        <p className="mt-2">
          Para cualquier consulta sobre tus datos, escribe a{" "}
          <a className="underline" href={`mailto:${contact}`}>
            {contact}
          </a>
          .
        </p>
      )}

      <h2 className="mt-8 text-xl font-semibold">Contenido que subes</h2>
      <p className="mt-2">
        Sube solo documentos que tengas derecho a usar. La sincronización es para tu uso personal y tus archivos no se
        comparten con otras personas.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Cambios</h2>
      <p className="mt-2">Si esta política cambia, se actualizará en esta misma página.</p>
    </main>
  );
}
