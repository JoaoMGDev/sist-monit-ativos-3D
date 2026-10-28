import { useEffect, useState } from "react";
import {
  Bell,
  Boxes,
  Check,
  ChevronLeft,
  ChevronRight,
  Hammer,
  Save,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Passo {
  titulo: string;
  texto: string;
  icon: React.ElementType;
}

const PASSOS: Passo[] = [
  {
    titulo: "Bem-vindo ao AtivosTI",
    texto:
      "Aqui você acompanha todos os ativos de TI da empresa em tempo real, com mapa isométrico 3D por ambiente e inventário consolidado.",
    icon: Boxes,
  },
  {
    titulo: "Busca inteligente",
    texto:
      "Digite o número de patrimônio, o nome ou o IP na busca do topo e clique na lupa: o sistema abre a sala e centraliza a câmera no equipamento.",
    icon: Search,
  },
  {
    titulo: "Modo Edição no mapa",
    texto:
      "Administradores ativam a Caixa de Ferramentas na Visão Micro para arrastar equipamentos pela grade. Clique com o botão direito para editar, transferir ou excluir um ativo.",
    icon: Hammer,
  },
  {
    titulo: "Salvar alterações",
    texto:
      "O botão de disquete fica ativo assim que existe uma alteração espacial pendente. Clique nele para consolidar o novo layout da sala para todos os usuários.",
    icon: Save,
  },
  {
    titulo: "Alertas e histórico",
    texto:
      "O sininho mostra quedas e reconexões em tempo real, com atalho para localizar o ativo. Ao lado, o ícone de histórico abre os logs completos e filtráveis.",
    icon: Bell,
  },
  {
    titulo: "Personalize a experiência",
    texto:
      "Em Configurações você ajusta tema, cores de status, volume e toque dos alertas, além do intervalo de atualização dos gráficos.",
    icon: SlidersHorizontal,
  },
];

export function TutorialDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (open) setI(0);
  }, [open]);

  const passo = PASSOS[i]!;
  const Icon = passo.icon;
  const ultimo = i === PASSOS.length - 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] gap-0 p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Tutorial do AtivosTI</DialogTitle>

        <div className="flex h-44 items-center justify-center border-b border-border bg-muted/50 sm:h-52">
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Icon className="h-7 w-7" />
            </span>
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Passo {i + 1} de {PASSOS.length}
            </span>
          </div>
        </div>

        <div className="space-y-2 px-6 py-5">
          <h3 className="text-base font-semibold tracking-tight">{passo.titulo}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{passo.texto}</p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <div className="flex items-center gap-1.5">
            {PASSOS.map((_, idx) => (
              <button
                key={idx}
                aria-label={`Ir para o passo ${idx + 1}`}
                onClick={() => setI(idx)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  idx === i ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setI((v) => v - 1)}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>
            )}
            {ultimo ? (
              <Button size="sm" onClick={() => onOpenChange(false)}>
                <Check className="mr-1 h-4 w-4" /> Concluir
              </Button>
            ) : (
              <Button size="sm" onClick={() => setI((v) => v + 1)}>
                Próximo <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
