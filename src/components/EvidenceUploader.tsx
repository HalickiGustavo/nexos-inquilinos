import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X, FileVideo } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const BUCKET = "maintenance-evidence";

export function EvidenceUploader({
  value,
  onChange,
  max = 8,
}: {
  value: string[];
  onChange: (paths: string[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Não autenticado");
    setUploading(true);
    const added: string[] = [];
    try {
      for (const f of Array.from(files).slice(0, max - value.length)) {
        const ext = f.name.split(".").pop() ?? "bin";
        const path = `${u.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
          contentType: f.type,
          upsert: false,
        });
        if (error) throw error;
        added.push(path);
      }
      onChange([...value, ...added]);
      toast.success(`${added.length} arquivo(s) anexado(s)`);
    } catch (e: any) {
      toast.error(e.message ?? "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <EvidenceGrid paths={value} onRemove={(p) => onChange(value.filter((x) => x !== p))} />
      {value.length < max && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className={cn("w-full border-dashed", uploading && "opacity-60")}
        >
          {uploading ? (
            <Loader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <ImagePlus className="size-4 mr-1.5" />
          )}
          Anexar foto ou vídeo ({value.length}/{max})
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

export function EvidenceGrid({
  paths,
  onRemove,
}: {
  paths: string[];
  onRemove?: (p: string) => void;
}) {
  if (!paths || paths.length === 0) return null;
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {paths.map((p) => (
        <EvidenceThumb key={p} path={p} onRemove={onRemove ? () => onRemove(p) : undefined} />
      ))}
    </div>
  );
}

function EvidenceThumb({ path, onRemove }: { path: string; onRemove?: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(path);

  useEffect(() => {
    let alive = true;
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  return (
    <div className="relative aspect-square rounded-md overflow-hidden border bg-muted group">
      {url ? (
        isVideo ? (
          <div className="w-full h-full flex items-center justify-center bg-black">
            <video src={url} className="w-full h-full object-cover" muted />
            <FileVideo className="absolute size-6 text-white/80" />
          </div>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
            <img src={url} alt="evidência" className="w-full h-full object-cover" />
          </a>
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 size-5 rounded-full bg-black/70 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
