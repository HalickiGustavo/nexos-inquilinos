import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Loader2, ImagePlus, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const BUCKET = "property-images";

export function PropertyPhotosUploader({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const photosQ = useQuery({
    queryKey: ["property-photos", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_photos")
        .select("id, url, position")
        .eq("property_id", propertyId)
        .order("position", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    try {
      const existing = photosQ.data ?? [];
      let nextPos = existing.length;
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          toast.error(`"${file.name}" não é uma imagem.`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`"${file.name}" excede 10MB.`);
          continue;
        }
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
        });
        if (upErr) {
          toast.error(`Falha ao enviar "${file.name}": ${upErr.message}`);
          continue;
        }
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const { error: insErr } = await supabase.from("property_photos").insert({
          property_id: propertyId,
          user_id: user.id,
          url: pub.publicUrl,
          position: nextPos++,
        });
        if (insErr) {
          toast.error(`Erro ao registrar foto: ${insErr.message}`);
          await supabase.storage.from(BUCKET).remove([path]);
        }
      }
      toast.success("Fotos enviadas!");
      qc.invalidateQueries({ queryKey: ["property-photos", propertyId] });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removePhoto(photo: { id: string; url: string }) {
    if (!confirm("Remover esta foto?")) return;
    try {
      const marker = `/${BUCKET}/`;
      const idx = photo.url.indexOf(marker);
      if (idx >= 0) {
        const path = photo.url.slice(idx + marker.length);
        await supabase.storage.from(BUCKET).remove([path]);
      }
    } catch {/* ignore storage errors, still drop DB row */}
    const { error } = await supabase.from("property_photos").delete().eq("id", photo.id);
    if (error) return toast.error(error.message);
    toast.success("Foto removida");
    qc.invalidateQueries({ queryKey: ["property-photos", propertyId] });
  }

  async function makePrimary(photoId: string) {
    const list = photosQ.data ?? [];
    const reordered = [photoId, ...list.map((p) => p.id).filter((id) => id !== photoId)];
    await Promise.all(
      reordered.map((id, i) =>
        supabase.from("property_photos").update({ position: i }).eq("id", id),
      ),
    );
    toast.success("Foto principal atualizada");
    qc.invalidateQueries({ queryKey: ["property-photos", propertyId] });
  }

  const photos = photosQ.data ?? [];

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <ImagePlus className="size-4 text-primary" /> Fotos do imóvel
          </h4>
          <p className="text-xs text-muted-foreground">
            A primeira foto é a principal nos portais (Zap, VivaReal, OLX).
          </p>
        </div>
        <Button type="button" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
          {uploading ? "Enviando..." : "Adicionar fotos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {photosQ.isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando fotos...</p>
      ) : photos.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">
          Nenhuma foto enviada ainda.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {photos.map((ph, i) => (
            <div key={ph.id} className="relative group rounded-md overflow-hidden border bg-muted aspect-square">
              <img src={ph.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
              {i === 0 && (
                <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                  Principal
                </span>
              )}
              <div className="absolute inset-x-0 bottom-0 p-1 flex gap-1 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition">
                {i !== 0 && (
                  <Button type="button" size="icon" variant="secondary" className="h-6 w-6" onClick={() => makePrimary(ph.id)} title="Tornar principal">
                    <Star className="size-3" />
                  </Button>
                )}
                <Button type="button" size="icon" variant="destructive" className="h-6 w-6 ml-auto" onClick={() => removePhoto(ph)} title="Remover">
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
