import { Link } from "react-router-dom";
import { AudioLines, ArrowLeft } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="grid h-full place-items-center bg-bg p-6">
      <div className="card card-pad w-full max-w-md text-center">
        <span className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-rose-500/12">
          <AudioLines className="size-5 text-accent" />
        </span>
        <h1 className="text-2xl font-medium text-ink">404</h1>
        <p className="mt-2 text-sm text-muted">Esta ruta no existe en SoundViewer.</p>
        <Link to="/" className="btn-outline btn-xs mx-auto mt-5">
          <ArrowLeft className="size-3.5" />
          Volver al reproductor
        </Link>
      </div>
    </div>
  );
}
