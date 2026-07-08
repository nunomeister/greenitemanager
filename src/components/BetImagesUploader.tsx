import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, X, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  userId: string;
  value: string[];
  onChange: (urls: string[]) => void;
  canEdit?: boolean;
}

export default function BetImagesUploader({ userId, value, onChange, canEdit = true }: Props) {
  const [uploading, setUploading] = useState(false);

  const openSignedUrl = async (path: string) => {
    const { data } = await supabase.storage.from('bet-prints').createSignedUrl(path, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    const newPaths: string[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { toast.error(`${file.name}: só imagens`); continue; }
      if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name}: máx 8MB`); continue; }
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      const { error } = await supabase.storage.from('bet-prints').upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) toast.error(error.message);
      else newPaths.push(path);
    }
    setUploading(false);
    if (newPaths.length) {
      onChange([...(value ?? []), ...newPaths]);
      toast.success(`${newPaths.length} imagem(ns) carregada(s)`);
    }
  };

  const removeAt = async (idx: number) => {
    const path = value[idx];
    await supabase.storage.from('bet-prints').remove([path]).catch(()=>{});
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {canEdit && (
        <label className="flex items-center gap-2 cursor-pointer">
          <Button asChild type="button" variant="outline" size="sm" disabled={uploading}>
            <span>{uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />} Anexar prints</span>
          </Button>
          <input type="file" accept="image/*" multiple className="hidden" onChange={e => { handleFiles(e.target.files); e.currentTarget.value = ''; }} />
          <span className="text-xs text-muted-foreground">{value?.length ?? 0} anexo(s)</span>
        </label>
      )}
      {value?.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {value.map((path, idx) => (
            <div key={path} className="relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted/30">
              <button type="button" onClick={() => openSignedUrl(path)} className="w-full h-full flex items-center justify-center">
                <BetImageThumb path={path} />
              </button>
              {canEdit && (
                <button type="button" onClick={() => removeAt(idx)} className="absolute top-1 right-1 p-1 rounded-full bg-destructive/90 text-destructive-foreground opacity-0 group-hover:opacity-100 transition">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BetImageThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.storage.from('bet-prints').createSignedUrl(path, 60 * 10).then(({ data }) => { if (alive) setUrl(data?.signedUrl ?? null); });
    return () => { alive = false; };
  }, [path]);
  if (!url) return <ImageIcon className="h-6 w-6 text-muted-foreground" />;
  return <img src={url} alt="print" className="w-full h-full object-cover" />;
}
  if (!url) return <ImageIcon className="h-6 w-6 text-muted-foreground" />;
  return <img src={url} alt="print" className="w-full h-full object-cover" />;
}
