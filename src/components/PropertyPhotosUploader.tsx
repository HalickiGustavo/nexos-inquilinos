import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, Trash2, Loader2, ImagePlus, Star, GripVertical } from "lucide-react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useConfirm } from "@/components/ui/confirm";

const BUCKET = "property-images";
const SIGNED_TTL = 60 * 60; // 1h

type Photo = { id: string; url: string; position: number; displayUrl: string };

function extractPath(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length).split("?")[0];
}

async function signPhotoUrls(rows: Array<{ id: string; url: string; position: number }>): Promise<Photo[]> {
  return Promise.all(
    rows.map(async (r) => {
      const path = extractPath(r.url);
      if (!path) return { ...r, displayUrl: r.url };
      const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_TTL);
      return { ...r, displayUrl: data?.signedUrl ?? r.url };
    }),
  );
}

function SortablePhoto({
  photo,
  index,
  isDragging,
  onMakePrimary,
  onRemove,
}: {
  photo: Photo;
  index: number;
  isDragging: boolean;
  onMakePrimary: (id: string) => void;
  onRemove: (p: Photo) => void;
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging: itemDragging,
  } = useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group rounded-md overflow-hidden border bg-muted aspect-square select-none transition
        ${itemDragging || isDragging ? "opacity-40 ring-2 ring-primary" : ""}`}
    >
      <img
        src={photo.displayUrl}
        alt={`Foto ${index + 1}`}
        className="w-full h-full object-cover pointer-events-none"
        loading="lazy"
        draggable={false}
      />
      <div className="absolute top-1 left-1 flex items-center gap-1">
        {/* Drag handle — large hit area for mobile */}
        <button
          type="button"
          aria-label="Arrastar para reordenar"
          {...attributes}
          {...listeners}
          className="touch-none bg-black/70 text-white rounded p-1.5 flex items-center cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
        {index === 0 && (
          <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
            Principal
          </span>
        )}
      </div>
      <span className="absolute top-1 right-1 text-[10px] bg-black/70 text-white rounded px-1.5 py-0.5">
        #{index + 1}
      </span>
      <div className="absolute inset-x-0 bottom-0 p-1 flex gap-1 bg-gradient-to-t from-black/80 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition">
        {index !== 0 && (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-7 w-7"
            onClick={() => onMakePrimary(photo.id)}
            title="Tornar principal"
          >
            <Star className="size-3.5" />
          </Button>
        )}
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="h-7 w-7 ml-auto"
          onClick={() => onRemove(photo)}
          title="Remover"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function PropertyPhotosUploader({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [order, setOrder] = useState<Photo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      return signPhotoUrls(data ?? []);
    },
  });

  useEffect(() => {
    if (photosQ.data) setOrder(photosQ.data);
  }, [photosQ.data]);

  async function persistOrder(next: Photo[]) {
    setSavingOrder(true);
    try {
      const results = await Promise.all(
        next.map((p, i) =>
          supabase.from("property_photos").update({ position: i }).eq("id", p.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      toast.success("Ordem das fotos atualizada");
      qc.invalidateQueries({ queryKey: ["property-photos", propertyId] });
    } catch (e: any) {
      toast.error(`Falha ao salvar ordem: ${e.message ?? e}`);
    } finally {
      setSavingOrder(false);
    }
  }

  function onDragStart(ev: DragStartEvent) {
    setActiveId(String(ev.active.id));
  }
  function onDragEnd(ev: DragEndEvent) {
    setActiveId(null);
    const { active, over } = ev;
    if (!over || active.id === over.id) return;
    const oldIndex = order.findIndex((p) => p.id === active.id);
    const newIndex = order.findIndex((p) => p.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    setOrder(next);
    persistOrder(next);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !user) return;
    setUploading(true);
    try {
      let nextPos = order.length;
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
        // Armazenamos o path lógico — a URL pública/assinada é gerada no momento da exibição/feed
        const storedUrl = `/${BUCKET}/${path}`;
        const { error: insErr } = await supabase.from("property_photos").insert({
          property_id: propertyId,
          user_id: user.id,
          url: storedUrl,
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

  async function removePhoto(photo: Photo) {
    if (!confirm("Remover esta foto?")) return;
    try {
      const path = extractPath(photo.url);
      if (path) await supabase.storage.from(BUCKET).remove([path]);
    } catch {/* ignore */}
    const { error } = await supabase.from("property_photos").delete().eq("id", photo.id);
    if (error) return toast.error(error.message);
    toast.success("Foto removida");
    qc.invalidateQueries({ queryKey: ["property-photos", propertyId] });
  }

  function makePrimary(photoId: string) {
    const current = [...order];
    const idx = current.findIndex((p) => p.id === photoId);
    if (idx <= 0) return;
    const [moved] = current.splice(idx, 1);
    current.unshift(moved);
    setOrder(current);
    persistOrder(current);
  }

  const active = activeId ? order.find((p) => p.id === activeId) : null;

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <ImagePlus className="size-4 text-primary" /> Fotos do imóvel
          </h4>
          <p className="text-xs text-muted-foreground">
            Segure a alça <GripVertical className="inline size-3 -mt-0.5" /> e arraste para reordenar (funciona no toque).
            A foto #1 é a principal no feed XML.
            {savingOrder && (
              <span className="ml-2 inline-flex items-center gap-1 text-primary">
                <Loader2 className="size-3 animate-spin" /> salvando ordem...
              </span>
            )}
          </p>
        </div>
        <Button type="button" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()} className="shrink-0">
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
      ) : order.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-6 border border-dashed rounded-md">
          Nenhuma foto enviada ainda.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext items={order.map((p) => p.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {order.map((ph, i) => (
                <SortablePhoto
                  key={ph.id}
                  photo={ph}
                  index={i}
                  isDragging={activeId === ph.id}
                  onMakePrimary={makePrimary}
                  onRemove={removePhoto}
                />
              ))}
            </div>
          </SortableContext>
          <DragOverlay>
            {active ? (
              <div className="rounded-md overflow-hidden border-2 border-primary shadow-2xl aspect-square w-32 bg-muted">
                <img src={active.displayUrl} alt="" className="w-full h-full object-cover" />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
