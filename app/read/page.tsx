import { Suspense } from "react";
import { Reader } from "@/components/reader/Reader";

export default function ReadPage() {
  return (
    <Suspense>
      <Reader />
    </Suspense>
  );
}
