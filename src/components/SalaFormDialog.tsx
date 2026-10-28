import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { CATALOGOS, store, onlyDigits, type Catalogo, type Sala } from "@/lib/asset-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  /** Quando informado, o painel edita a sala (modo construção). */
  sala?: Sala;
  trigger?: React.ReactNode;
}

export function SalaFormDialog({ sala, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: sala?.nome ?? "",
    numero: sala?.numero ?? "",
    catalogo: (sala?.catalogo ?? CATALOGOS[0]) as Catalogo,
    largura: String(sala?.largura ?? 12),
    profundidade: String(sala?.profundidade ?? 9),
  });

  const submit = () => {
    const largura = Number(form.largura);
    const profundidade = Number(form.profundidade);
    if (!form.nome.trim()) {
      toast("Informe o nome da sala.");
      return;
    }
    if (!form.numero.trim()) {
      toast("Informe o número da sala.");
      return;
    }
    if (!(largura >= 4 && largura <= 40)) {
      toast("Largura deve estar entre 4m e 40m.");
      return;
    }
    if (!(profundidade >= 4 && profundidade <= 40)) {
      toast("Altura (profundidade) deve estar entre 4m e 40m.");
      return;
    }

    if (sala) {
      store.updateSala(sala.id, {
        nome: form.nome.trim(),
        numero: form.numero,
        catalogo: form.catalogo,
        largura,
        profundidade,
      });
      toast("Ambiente atualizado", { description: `${form.nome} agora tem ${largura}m × ${profundidade}m.` });
    } else {
      store.addSala({
        nome: form.nome.trim(),
        numero: form.numero,
        catalogo: form.catalogo,
        largura,
        profundidade,
      });
      toast("Ambiente criado", { description: `${form.nome} (${form.catalogo}) adicionado ao mapeamento.` });
      setForm({ nome: "", numero: "", catalogo: CATALOGOS[0], largura: "12", profundidade: "9" });
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) return;
        setForm({
          nome: sala?.nome ?? "",
          numero: sala?.numero ?? "",
          catalogo: (sala?.catalogo ?? CATALOGOS[0]) as Catalogo,
          largura: String(sala?.largura ?? 12),
          profundidade: String(sala?.profundidade ?? 9),
        });
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Novo ambiente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sala ? `Editar ambiente · ${sala.nome}` : "Criar novo ambiente"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Nome da sala</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Laboratório de Redes"
              />
            </div>
            <div className="grid gap-2">
              <Label>Número da sala</Label>
              <Input
                inputMode="numeric"
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: onlyDigits(e.target.value).slice(0, 5) })}
                placeholder="204"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Catálogo</Label>
            <Select
              value={form.catalogo}
              onValueChange={(v) => setForm({ ...form, catalogo: v as Catalogo })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATALOGOS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Largura (m)</Label>
              <Input
                type="number"
                min={4}
                max={40}
                value={form.largura}
                onChange={(e) => setForm({ ...form, largura: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Altura / profundidade (m)</Label>
              <Input
                type="number"
                min={4}
                max={40}
                value={form.profundidade}
                onChange={(e) => setForm({ ...form, profundidade: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{sala ? "Salvar alterações" : "Criar ambiente"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
