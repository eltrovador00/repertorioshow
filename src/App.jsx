import { useState, useEffect, useRef } from "react"
import jsPDF from "jspdf"
import "./App.css"
import logoArcanjos from "./assets/logo.jpeg"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts"
import { auth, db } from "./firebase"
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "firebase/auth"
import {
  doc,
  getDoc,
  setDoc,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore"
import { DndContext, closestCenter } from "@dnd-kit/core"
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
  arrayMove
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

function MusicaArrastavel({ musica, textoExibicao, index, bloco, removerDoBloco, podeEditar }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: `${bloco.nome}|||${index}|||${musica}`
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        width: "100%"
      }}
      className="block-song"
    >
      <div
        {...attributes}
        {...listeners}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          cursor: "grab",
          userSelect: "none"
        }}
      >
        <span>☰</span>
        <span>{index + 1}.</span>
        <span>{textoExibicao || musica}</span>
      </div>

      {podeEditar && (
        <button
          onClick={() => removerDoBloco(bloco.nome, musica)}
          style={{
            width: "30px",
            height: "30px",
            background: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            padding: 0
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

function BlocoArrastavel({ children, bloco }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: `bloco|||${bloco.nome}`
    })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return children({
    setNodeRef,
    style,
    attributes,
    listeners
  })
}

const NOTAS = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B"
]

const MAPA_BEMOL = {
  DB: "C#",
  EB: "D#",
  GB: "F#",
  AB: "G#",
  BB: "A#"
}

function normalizarMusica(musica) {
  if (typeof musica === "string") {
    return {
      nome: musica,
      tom: "",
      letra: "",
      cifra: "",
      tags: [],
      favorito: false,
      execucoes: 0
    }
  }

  return {
    nome: musica.nome || "",
    tom: musica.tom || "",
    letra: musica.letra || "",
    cifra: musica.cifra || "",
    tags: Array.isArray(musica.tags) ? musica.tags : [],
    favorito: Boolean(musica.favorito),
    execucoes: musica.execucoes || 0
  }
}

function transporTom(tom, passos) {
  if (!tom) return ""

  const match = tom.trim().toUpperCase().match(/^([A-G](#|B)?)(.*)$/)

  if (!match) return tom

  let nota = match[1]
  const resto = match[3] || ""

  nota = MAPA_BEMOL[nota] || nota

  const indice = NOTAS.indexOf(nota)

  if (indice === -1) return tom

  const novoIndice = (indice + passos + NOTAS.length) % NOTAS.length

  return `${NOTAS[novoIndice]}${resto}`
}

function transporCifra(cifra, passos) {
  if (!cifra) return ""

  return cifra.replace(/\b([A-G](?:#|b)?)(m|maj|min|sus|dim|aug|add)?([0-9]*)?(\/[A-G](?:#|b)?)?/gi, (acorde, nota, tipo = "", numero = "", baixo = "") => {
    const novaNota = transporTom(nota, passos)

    let novoBaixo = ""

    if (baixo) {
      novoBaixo = "/" + transporTom(baixo.replace("/", ""), passos)
    }

    return `${novaNota}${tipo}${numero}${novoBaixo}`
  })
}

function App() {
  const palcoRef = useRef(null)
  const [musicas, setMusicas] = useState(() => {
    const dados = localStorage.getItem("musicas")

    if (dados) {
      return JSON.parse(dados).map(normalizarMusica)
    }

    return [
      { nome: "DESPERTA", tom: "", letra: "", cifra: "", tags: [], favorito: false, execucoes: 0 },
      { nome: "TEMPLO VIVO", tom: "", letra: "", cifra: "", tags: [], favorito: false, execucoes: 0 },
      { nome: "PROFETIZA, FILHO DE MARIA", tom: "", letra: "", cifra: "", tags: [], favorito: false, execucoes: 0 },
      { nome: "DANÇA DE AVIVAMENTO", tom: "", letra: "", cifra: "", tags: [], favorito: false, execucoes: 0 },
      { nome: "ORA QUE MELHORA", tom: "", letra: "", cifra: "", tags: [], favorito: false, execucoes: 0 },
      { nome: "SENTINELA DA MANHÃ", tom: "", letra: "", cifra: "", tags: [], favorito: false, execucoes: 0 }
    ]
  })

  const [blocos, setBlocos] = useState(() => {
    const dados = localStorage.getItem("blocos")

    return dados
      ? JSON.parse(dados)
      : [
          { nome: "Abertura", cor: "green", musicas: [] },
          { nome: "Bloco 1", cor: "blue", musicas: [] },
          { nome: "Sofrência", cor: "orange", musicas: [] }
        ]
  })

  const [novaMusica, setNovaMusica] = useState("")
  const [busca, setBusca] = useState("")
  const [blocoSelecionado, setBlocoSelecionado] = useState("Abertura")
  const [novoBloco, setNovoBloco] = useState("")
  const [logoPersonalizada, setLogoPersonalizada] = useState(() => {
  return localStorage.getItem("logoPersonalizada") || ""
})
const [usuario, setUsuario] = useState(null)
const [perfilUsuario, setPerfilUsuario] = useState(null)
const podeEditar =
  perfilUsuario?.permissao === "admin" ||
  perfilUsuario?.permissao === "editor"

const podeExcluir =
  perfilUsuario?.permissao === "admin"

const podeControlarPalco =
  perfilUsuario?.permissao === "admin" ||
  perfilUsuario?.permissao === "editor"
const [emailLogin, setEmailLogin] = useState("")
const [senhaLogin, setSenhaLogin] = useState("")
const [carregandoLogin, setCarregandoLogin] = useState(true)
  const [modalEventoAberto, setModalEventoAberto] = useState(false)
const [eventoEditando, setEventoEditando] = useState(null)
const [nomeEventoEditando, setNomeEventoEditando] = useState("")
const [dataEventoEditando, setDataEventoEditando] = useState("")
const [horarioEventoEditando, setHorarioEventoEditando] = useState("")
const [localEventoEditando, setLocalEventoEditando] = useState("")
const [repertorioEventoEditando, setRepertorioEventoEditando] = useState("")
  const [indiceMusicaPalco, setIndiceMusicaPalco] = useState(0)
  const [listaPalco, setListaPalco] = useState([])
const [sessaoPalco, setSessaoPalco] = useState(null)
const [mensagemHost, setMensagemHost] = useState("")
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const [modalEditarRepertorioAberto, setModalEditarRepertorioAberto] =
    useState(false)
  const [novoNomeRepertorio, setNovoNomeRepertorio] = useState("")

  const [rolagemAtiva, setRolagemAtiva] = useState(false)
  const [velocidadeRolagem, setVelocidadeRolagem] = useState(1)

  const [blocoEditando, setBlocoEditando] = useState("")
  const [novoNomeBloco, setNovoNomeBloco] = useState("")
  const [corBlocoEditando, setCorBlocoEditando] = useState("green")
  const [tagSelecionada, setTagSelecionada] = useState("Todas")

  const [temaEscuro, setTemaEscuro] = useState(() => {
    return localStorage.getItem("temaEscuro") === "true"
  })

  const [modoPalcoVisualizacao, setModoPalcoVisualizacao] = useState("letra")
  const [modoVisualizacao, setModoVisualizacao] = useState("letra")

  const [modalMusicaAberto, setModalMusicaAberto] = useState(false)
  const [musicaEditando, setMusicaEditando] = useState(null)
  const [nomeMusicaEditando, setNomeMusicaEditando] = useState("")
  const [tomMusicaEditando, setTomMusicaEditando] = useState("")
  const [letraMusicaEditando, setLetraMusicaEditando] = useState("")
  const [cifraMusicaEditando, setCifraMusicaEditando] = useState("")
  const [tagsMusicaEditando, setTagsMusicaEditando] = useState("")
  const [eventos, setEventos] = useState(() => {
  const dados = localStorage.getItem("eventos")
  return dados ? JSON.parse(dados) : []
})
const [nomeMinisterio, setNomeMinisterio] = useState(() => {
  return localStorage.getItem("nomeMinisterio") || "MINISTÉRIO ARCANJOS DA EUCARISTIA"
})

const [tituloPDF, setTituloPDF] = useState(() => {
  return localStorage.getItem("tituloPDF") || "REPERTÓRIO DO SHOW"
})

const [rodapePDF, setRodapePDF] = useState(() => {
  return localStorage.getItem("rodapePDF") || "Gerado pelo Meu Repertório"
})
const [nomeEvento, setNomeEvento] = useState("")
const [dataEvento, setDataEvento] = useState("")
const [localEvento, setLocalEvento] = useState("")
const [horarioEvento, setHorarioEvento] = useState("")
const [modalConfiguracoesAberto, setModalConfiguracoesAberto] = useState(false)

  const [modoPalcoAberto, setModoPalcoAberto] = useState(false)
  const [musicaPalco, setMusicaPalco] = useState(null)

  const [modalExcluirAberto, setModalExcluirAberto] = useState(false)
  const [itemExcluindo, setItemExcluindo] = useState("")

  const [modalLetraAberto, setModalLetraAberto] = useState(false)
  const [musicaVisualizando, setMusicaVisualizando] = useState(null)

  const [historicoExecucoes, setHistoricoExecucoes] = useState(() => {
    const dados = localStorage.getItem("historicoExecucoes")
    return dados ? JSON.parse(dados) : []
  })

  const [repertorios, setRepertorios] = useState(() => {
    const dadosRepertorios = localStorage.getItem("repertorios")
    const dadosBlocos = localStorage.getItem("blocos")
    const blocosSalvos = dadosBlocos ? JSON.parse(dadosBlocos) : []

    if (dadosRepertorios) {
      const repertoriosSalvos = JSON.parse(dadosRepertorios)

      return repertoriosSalvos.map((rep, index) => {
        if (index === 0 && (!rep.blocos || rep.blocos.length === 0)) {
          return {
            ...rep,
            blocos: blocosSalvos
          }
        }

        return {
          ...rep,
          blocos: rep.blocos || []
        }
      })
    }

    return [
      {
        nome: "Repertório Principal",
        blocos: blocosSalvos
      }
    ]
  })

  const [repertorioAtual, setRepertorioAtual] = useState(() => {
    const dadosRepertorios = localStorage.getItem("repertorios")

    if (dadosRepertorios) {
      const lista = JSON.parse(dadosRepertorios)
      return lista[0]?.nome || "Repertório Principal"
    }

    return "Repertório Principal"
  })

  const [novoRepertorio, setNovoRepertorio] = useState("")

  useEffect(() => {
    localStorage.setItem("musicas", JSON.stringify(musicas))
  }, [musicas])

  useEffect(() => {
    setRepertorios((repertoriosAtuais) =>
      repertoriosAtuais.map((rep) =>
        rep.nome === repertorioAtual
          ? {
              ...rep,
              blocos
            }
          : rep
      )
    )

    localStorage.setItem("blocos", JSON.stringify(blocos))
  }, [blocos, repertorioAtual])

  useEffect(() => {
    localStorage.setItem("repertorios", JSON.stringify(repertorios))
  }, [repertorios])

  useEffect(() => {
    localStorage.setItem("historicoExecucoes", JSON.stringify(historicoExecucoes))
  }, [historicoExecucoes])

  useEffect(() => {
    const repertorioEncontrado = repertorios.find(
      (rep) => rep.nome === repertorioAtual
    )

    if (repertorioEncontrado) {
      setBlocos(repertorioEncontrado.blocos || [])
    }
  }, [repertorioAtual])

  useEffect(() => {
    localStorage.setItem("temaEscuro", temaEscuro)
  }, [temaEscuro])

  useEffect(() => {
    if (modoPalcoAberto) {
      document.body.classList.add("stage-open")
      document.documentElement.classList.add("stage-open")
    } else {
      document.body.classList.remove("stage-open")
      document.documentElement.classList.remove("stage-open")
    }

    return () => {
      document.body.classList.remove("stage-open")
      document.documentElement.classList.remove("stage-open")
    }
  }, [modoPalcoAberto])
  useEffect(() => {
    if (!modoPalcoAberto) return
    if (!rolagemAtiva) return

    const palco = palcoRef.current
    if (!palco) return

    const intervalo = setInterval(() => {
      palco.scrollTop += velocidadeRolagem
    }, 30)

    return () => clearInterval(intervalo)
  }, [rolagemAtiva, velocidadeRolagem, modoPalcoAberto])

  useEffect(() => {
    if (!modoPalcoAberto) return

    function controlarTeclas(event) {
      const alvo = event.target

      if (
        alvo?.tagName === "INPUT" ||
        alvo?.tagName === "TEXTAREA" ||
        alvo?.isContentEditable
      ) {
        return
      }

      switch (event.key) {
        case "ArrowRight":
          if (sessaoPalco?.ativo && podeControlarPalco) {
            proximaMusicaAoVivo()
          } else {
            proximaMusicaPalco()
          }
          break

        case "ArrowLeft":
          if (sessaoPalco?.ativo && podeControlarPalco) {
            musicaAnteriorAoVivo()
          } else {
            musicaAnteriorPalco()
          }
          break

        case " ":
          event.preventDefault()
          setRolagemAtiva((estado) => {
            const novoEstado = !estado

            if (podeControlarPalco && sessaoPalco?.ativo) {
              atualizarSessaoPalco({
                rolagemAtiva: novoEstado,
                velocidadeRolagem
              })
            }

            return novoEstado
          })
          break

        case "Escape":
          fecharModoPalco()
          break

        case "+":
        case "=":
          setVelocidadeRolagem((v) => {
            const novaVelocidade = v + 1

            if (podeControlarPalco && sessaoPalco?.ativo) {
              atualizarSessaoPalco({
                velocidadeRolagem: novaVelocidade
              })
            }

            return novaVelocidade
          })
          break

        case "-":
          setVelocidadeRolagem((v) => {
            const novaVelocidade = Math.max(1, v - 1)

            if (podeControlarPalco && sessaoPalco?.ativo) {
              atualizarSessaoPalco({
                velocidadeRolagem: novaVelocidade
              })
            }

            return novaVelocidade
          })
          break

        default:
          break
      }
    }

    window.addEventListener("keydown", controlarTeclas)

    return () => {
      window.removeEventListener("keydown", controlarTeclas)
    }
  }, [
    modoPalcoAberto,
    indiceMusicaPalco,
    listaPalco,
    sessaoPalco,
    podeControlarPalco,
    velocidadeRolagem
  ])

  function pegarMusica(nomeMusica) {
    return musicas.find((musica) => musica.nome === nomeMusica)
  }

  function pegarTomDaMusica(nomeMusica) {
    return pegarMusica(nomeMusica)?.tom || ""
  }

  function formatarMusicaParaExibir(nomeMusica) {
    const tom = pegarTomDaMusica(nomeMusica)
    return tom ? `${nomeMusica} (${tom})` : nomeMusica
  }

  async function adicionarMusicaAoBloco(nomeMusica) {
    if (!podeEditar) {
      alert("Você não possui permissão para editar repertórios.")
      return
    }

    if (!nomeMusica) {
      alert("Música inválida.")
      return
    }

    if (!Array.isArray(blocos) || blocos.length === 0) {
      alert("Crie um bloco antes de adicionar músicas.")
      return
    }

    const nomeBlocoDestino =
      blocoSelecionado && blocos.some((bloco) => bloco.nome === blocoSelecionado)
        ? blocoSelecionado
        : blocos[0].nome

    if (nomeBlocoDestino !== blocoSelecionado) {
      setBlocoSelecionado(nomeBlocoDestino)
    }

    const novosBlocos = blocos.map((bloco) => {
      const musicasDoBloco = Array.isArray(bloco.musicas)
        ? bloco.musicas
        : []

      if (bloco.nome !== nomeBlocoDestino) {
        return {
          ...bloco,
          musicas: musicasDoBloco
        }
      }

      return {
        ...bloco,
        musicas: musicasDoBloco.includes(nomeMusica)
          ? musicasDoBloco
          : [...musicasDoBloco, nomeMusica]
      }
    })

    const novosRepertorios = repertorios.map((rep) =>
      rep.nome === repertorioAtual
        ? {
            ...rep,
            blocos: novosBlocos
          }
        : rep
    )

    setBlocos(novosBlocos)
    setRepertorios(novosRepertorios)

    await salvarRepertoriosFirebase(novosRepertorios)
  }

  function excluirMusica(nomeMusica) {
    if (!podeExcluir) return
    const confirmar = window.confirm(`Deseja excluir a música "${nomeMusica}"?`)
    if (!confirmar) return

    setMusicas(musicas.filter((musica) => musica.nome !== nomeMusica))

    setBlocos(
      blocos.map((bloco) => ({
        ...bloco,
        musicas: bloco.musicas.filter((musica) => musica !== nomeMusica)
      }))
    )

    setRepertorios(
      repertorios.map((rep) => ({
        ...rep,
        blocos: (rep.blocos || []).map((bloco) => ({
          ...bloco,
          musicas: bloco.musicas.filter((musica) => musica !== nomeMusica)
        }))
      }))
    )
  }

  async function criarBloco() {
    if (!podeEditar) return
    if (!novoBloco.trim()) return

    const cores = ["green", "blue", "orange", "purple", "red"]

    const novosBlocos = [
      ...blocos,
      {
        nome: novoBloco.trim(),
        cor: cores[blocos.length % cores.length],
        musicas: []
      }
    ]

    const novosRepertorios = repertorios.map((rep) =>
      rep.nome === repertorioAtual
        ? {
            ...rep,
            blocos: novosBlocos
          }
        : rep
    )

    setBlocos(novosBlocos)
    setRepertorios(novosRepertorios)
    setNovoBloco("")

    await salvarRepertoriosFirebase(novosRepertorios)
  }

  function renomearBloco(nomeAtual) {
    if (!podeEditar) return
    const blocoAtual = blocos.find((bloco) => bloco.nome === nomeAtual)

    setBlocoEditando(nomeAtual)
    setNovoNomeBloco(nomeAtual)
    setCorBlocoEditando(blocoAtual?.cor || "green")
    setModalEditarAberto(true)
  }

  function salvarNovoNomeBloco() {
    if (!podeEditar) return
    if (!novoNomeBloco.trim()) return

    setBlocos(
      blocos.map((bloco) =>
        bloco.nome === blocoEditando
          ? {
              ...bloco,
              nome: novoNomeBloco.trim(),
              cor: corBlocoEditando
            }
          : bloco
      )
    )

    if (blocoSelecionado === blocoEditando) {
      setBlocoSelecionado(novoNomeBloco.trim())
    }

    setModalEditarAberto(false)
    setBlocoEditando("")
    setNovoNomeBloco("")
  }

  function excluirBloco(nomeBloco) {
    if (!podeExcluir) return
    setItemExcluindo(nomeBloco)
    setModalExcluirAberto(true)
  }

  function confirmarExclusao() {
    if (!podeExcluir) return
    const novosBlocos = blocos.filter((bloco) => bloco.nome !== itemExcluindo)

    setBlocos(novosBlocos)

    if (blocoSelecionado === itemExcluindo && novosBlocos.length > 0) {
      setBlocoSelecionado(novosBlocos[0].nome)
    }

    setModalExcluirAberto(false)
    setItemExcluindo("")
  }

  async function removerDoBloco(nomeBloco, nomeMusica) {
    if (!podeEditar) return

    const novosBlocos = blocos.map((bloco) =>
      bloco.nome === nomeBloco
        ? {
            ...bloco,
            musicas: (bloco.musicas || []).filter((musica) => musica !== nomeMusica)
          }
        : {
            ...bloco,
            musicas: Array.isArray(bloco.musicas) ? bloco.musicas : []
          }
    )

    const novosRepertorios = repertorios.map((rep) =>
      rep.nome === repertorioAtual
        ? {
            ...rep,
            blocos: novosBlocos
          }
        : rep
    )

    setBlocos(novosBlocos)
    setRepertorios(novosRepertorios)

    await salvarRepertoriosFirebase(novosRepertorios)
  }

  function criarRepertorio() {
    if (!podeEditar) return
    if (!novoRepertorio.trim()) return

    const nome = novoRepertorio.trim()

    const existe = repertorios.some((rep) => rep.nome === nome)

    if (existe) {
      alert("Já existe um repertório com esse nome.")
      return
    }

    setRepertorios([
      ...repertorios,
      {
        nome,
        blocos: []
      }
    ])

    setRepertorioAtual(nome)
    setBlocos([])
    setNovoRepertorio("")
  }

  function excluirRepertorio() {
    if (!podeExcluir) return
    if (repertorios.length <= 1) {
      alert("Você precisa manter pelo menos um repertório.")
      return
    }

    const confirmar = window.confirm(
      `Deseja excluir o repertório "${repertorioAtual}"?`
    )

    if (!confirmar) return

    const novosRepertorios = repertorios.filter(
      (rep) => rep.nome !== repertorioAtual
    )

    const proximoRepertorio = novosRepertorios[0]

    setRepertorios(novosRepertorios)
    setRepertorioAtual(proximoRepertorio.nome)
    setBlocos(proximoRepertorio.blocos || [])
  }

  function abrirEditarRepertorio() {
    if (!podeEditar) return
    setNovoNomeRepertorio(repertorioAtual)
    setModalEditarRepertorioAberto(true)
  }

  function salvarNovoNomeRepertorio() {
    if (!podeEditar) return
    if (!novoNomeRepertorio.trim()) return

    const nomeNovo = novoNomeRepertorio.trim()

    const existe = repertorios.some(
      (rep) => rep.nome === nomeNovo && rep.nome !== repertorioAtual
    )

    if (existe) {
      alert("Já existe um repertório com esse nome.")
      return
    }

    setRepertorios(
      repertorios.map((rep) =>
        rep.nome === repertorioAtual ? { ...rep, nome: nomeNovo } : rep
      )
    )

    setRepertorioAtual(nomeNovo)
    setModalEditarRepertorioAberto(false)
    setNovoNomeRepertorio("")
  }

  function duplicarRepertorio() {
    if (!podeEditar) return
    const repertorio = repertorios.find((rep) => rep.nome === repertorioAtual)

    if (!repertorio) return

    let novoNome = `${repertorio.nome} (Cópia)`
    let contador = 2

    while (repertorios.some((rep) => rep.nome === novoNome)) {
      novoNome = `${repertorio.nome} (Cópia ${contador})`
      contador++
    }

    const copia = {
      ...repertorio,
      nome: novoNome,
      blocos: JSON.parse(JSON.stringify(repertorio.blocos))
    }

    setRepertorios([...repertorios, copia])

    setRepertorioAtual(novoNome)
    setBlocos(copia.blocos)
  }

  function aoSoltar(event) {
    if (!podeEditar) return
    const { active, over } = event

    if (!over || active.id === over.id) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (activeId.startsWith("bloco|||") && overId.startsWith("bloco|||")) {
      const blocoOrigem = activeId.replace("bloco|||", "")
      const blocoDestino = overId.replace("bloco|||", "")

      const indiceOrigem = blocos.findIndex((bloco) => bloco.nome === blocoOrigem)
      const indiceDestino = blocos.findIndex((bloco) => bloco.nome === blocoDestino)

      if (indiceOrigem === -1 || indiceDestino === -1) return

      setBlocos(arrayMove(blocos, indiceOrigem, indiceDestino))
      return
    }

    const [blocoOrigem, , musicaMovida] = activeId.split("|||")

    let blocoDestino = ""

    if (overId.startsWith("bloco|||")) {
      blocoDestino = overId.replace("bloco|||", "")
    } else {
      blocoDestino = overId.split("|||")[0]
    }

    if (!blocoOrigem || !blocoDestino || !musicaMovida) return

    if (blocoOrigem === blocoDestino) {
      setBlocos(
        blocos.map((bloco) => {
          if (bloco.nome !== blocoOrigem) return bloco

          const indiceAntigo = bloco.musicas.findIndex(
            (musica, index) =>
              `${bloco.nome}|||${index}|||${musica}` === activeId
          )

          const indiceNovo = bloco.musicas.findIndex(
            (musica, index) =>
              `${bloco.nome}|||${index}|||${musica}` === overId
          )

          if (indiceAntigo === -1 || indiceNovo === -1) return bloco

          return {
            ...bloco,
            musicas: arrayMove(bloco.musicas, indiceAntigo, indiceNovo)
          }
        })
      )

      return
    }

    setBlocos(
      blocos.map((bloco) => {
        if (bloco.nome === blocoOrigem) {
          return {
            ...bloco,
            musicas: bloco.musicas.filter((musica) => musica !== musicaMovida)
          }
        }

        if (bloco.nome === blocoDestino) {
          return {
            ...bloco,
            musicas: [...bloco.musicas, musicaMovida]
          }
        }

        return bloco
      })
    )
  }

  function exportarPDF() {
    const doc = new jsPDF("p", "mm", "a4")

    const largura = doc.internal.pageSize.getWidth()
    const altura = doc.internal.pageSize.getHeight()

    function cabecalho() {
  doc.addImage(
    logoPersonalizada || logoArcanjos,
    "JPEG",
    78,
    8,
    54,
    20
  )

  doc.setFontSize(10)
  doc.setFont("helvetica", "bold")
  doc.text(nomeMinisterio, 105, 34, {
    align: "center"
  })

  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(tituloPDF, 105, 42, {
    align: "center"
  })

  doc.setFontSize(11)
  doc.setFont("helvetica", "normal")
  doc.text(`Repertório: ${repertorioAtual}`, 105, 50, {
    align: "center"
  })

  const data = new Date().toLocaleDateString("pt-BR")
  doc.text(`Data: ${data}`, 105, 57, {
    align: "center"
  })

  doc.setDrawColor(220, 90, 35)
  doc.setLineWidth(0.8)
  doc.line(20, 66, 190, 66)
}

    function rodape(pagina) {
      doc.setFontSize(9)
      doc.setTextColor(120)
     doc.text(`${rodapePDF} • Página ${pagina}`, largura / 2, altura - 8, {
  align: "center"
})
      doc.setTextColor(0)
    }

    let y = 78
    let pagina = 1

    cabecalho()

    blocos.forEach((bloco) => {
      if (y > 260) {
        rodape(pagina)
        doc.addPage()
        pagina++
        y = 25
      }

      doc.setFontSize(13)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(220, 90, 35)
      doc.text(bloco.nome.toUpperCase(), 20, y)

      y += 8

      doc.setFontSize(11)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(0)

      if (bloco.musicas.length === 0) {
        doc.text("Sem músicas", 25, y)
        y += 8
      } else {
        bloco.musicas.forEach((musica, index) => {
          if (y > 270) {
            rodape(pagina)
            doc.addPage()
            pagina++
            y = 25
          }

          doc.text(`${index + 1}. ${formatarMusicaParaExibir(musica)}`, 25, y)
          y += 7
        })
      }

      y += 8
    })

    rodape(pagina)

    doc.save(`repertorio-${repertorioAtual}.pdf`)
  }

  function compartilharRepertorio() {
    let texto = "🎤 *REPERTÓRIO DO SHOW*\n\n"

    blocos.forEach((bloco) => {
      texto += `🎵 *${bloco.nome.toUpperCase()}*\n`

      if (bloco.musicas.length === 0) {
        texto += "Sem músicas\n"
      } else {
        bloco.musicas.forEach((musica, index) => {
          texto += `${index + 1}. ${formatarMusicaParaExibir(musica)}\n`
        })
      }

      texto += "\n"
    })

    const mensagem = encodeURIComponent(texto)

    window.open(`https://wa.me/?text=${mensagem}`, "_blank")
  }

  function exportarBackupJSON() {
    const backup = {
      musicas,
      repertorios,
      repertorioAtual,
      historicoExecucoes,
      dataBackup: new Date().toISOString()
    }

    const arquivo = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json"
    })

    const url = URL.createObjectURL(arquivo)
    const link = document.createElement("a")

    link.href = url
    link.download = "backup-repertorio.json"
    link.click()

    URL.revokeObjectURL(url)
  }

  function importarBackupJSON(event) {
    const arquivo = event.target.files[0]

    if (!arquivo) return

    const leitor = new FileReader()

    leitor.onload = (e) => {
      try {
        const backup = JSON.parse(e.target.result)

        if (!backup.musicas || !backup.repertorios) {
          alert("Arquivo de backup inválido.")
          return
        }

        const musicasNormalizadas = backup.musicas.map(normalizarMusica)

        setMusicas(musicasNormalizadas)
        setRepertorios(backup.repertorios)
        setRepertorioAtual(backup.repertorioAtual || backup.repertorios[0].nome)
        setHistoricoExecucoes(backup.historicoExecucoes || [])
        setBlocos(
          backup.repertorios.find(
            (rep) =>
              rep.nome ===
              (backup.repertorioAtual || backup.repertorios[0].nome)
          )?.blocos || []
        )

        alert("Backup restaurado com sucesso!")
      } catch {
        alert("Erro ao importar backup.")
      }
    }

    leitor.readAsText(arquivo)
  }

  function editarMusica(musica) {
    setMusicaEditando(musica)
    setNomeMusicaEditando(musica.nome)
    setTomMusicaEditando(musica.tom || "")
    setLetraMusicaEditando(musica.letra || "")
    setCifraMusicaEditando(musica.cifra || "")
    setTagsMusicaEditando((musica.tags || []).join(", "))
    setModalMusicaAberto(true)
  }

  function salvarMusica() {
    if (!podeEditar) return
    if (!musicaEditando || !nomeMusicaEditando.trim()) return

    const nomeAntigo = musicaEditando.nome
    const nomeNovo = nomeMusicaEditando.trim().toUpperCase()

    const novasTags = tagsMusicaEditando
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)

    setMusicas(
      musicas.map((musica) =>
        musica.nome === nomeAntigo
          ? {
              ...musica,
              nome: nomeNovo,
              tom: tomMusicaEditando.trim().toUpperCase(),
              letra: letraMusicaEditando,
              cifra: cifraMusicaEditando,
              tags: novasTags
            }
          : musica
      )
    )

    setBlocos(
      blocos.map((bloco) => ({
        ...bloco,
        musicas: bloco.musicas.map((musica) =>
          musica === nomeAntigo ? nomeNovo : musica
        )
      }))
    )

    setRepertorios(
      repertorios.map((rep) => ({
        ...rep,
        blocos: (rep.blocos || []).map((bloco) => ({
          ...bloco,
          musicas: bloco.musicas.map((musica) =>
            musica === nomeAntigo ? nomeNovo : musica
          )
        }))
      }))
    )

    setModalMusicaAberto(false)
    setMusicaEditando(null)
    setNomeMusicaEditando("")
    setTomMusicaEditando("")
    setLetraMusicaEditando("")
    setCifraMusicaEditando("")
    setTagsMusicaEditando("")
  }

  function visualizarLetra(musica) {
    setMusicaVisualizando(musica)
    setModoVisualizacao("letra")
    setModalLetraAberto(true)
  }

  function abrirModoPalco(musica) {
    const todasMusicasDoRepertorio = blocos.flatMap((bloco) =>
      bloco.musicas.map((nomeMusica) => {
        const dadosMusica = musicas.find((m) => m.nome === nomeMusica)

        return (
          dadosMusica || {
            nome: nomeMusica,
            tom: "",
            letra: "",
            cifra: "",
            tags: [],
            favorito: false,
            execucoes: 0
          }
        )
      })
    )

    const indice = todasMusicasDoRepertorio.findIndex(
      (m) => m.nome === musica.nome
    )

    setListaPalco(todasMusicasDoRepertorio)
    setIndiceMusicaPalco(indice >= 0 ? indice : 0)
    setMusicaPalco(musica)
    setModoPalcoVisualizacao(modoVisualizacao)
    setModoPalcoAberto(true)

    setTimeout(() => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
      }
    }, 100)
  }

  function musicaAnteriorPalco() {
    if (listaPalco.length === 0) return

    const novoIndice =
      indiceMusicaPalco === 0 ? listaPalco.length - 1 : indiceMusicaPalco - 1

    setIndiceMusicaPalco(novoIndice)
    setMusicaPalco(listaPalco[novoIndice])
  }

  function proximaMusicaPalco() {
    if (listaPalco.length === 0) return

    const novoIndice =
      indiceMusicaPalco === listaPalco.length - 1 ? 0 : indiceMusicaPalco + 1

    setIndiceMusicaPalco(novoIndice)
    setMusicaPalco(listaPalco[novoIndice])
  }

  function fecharModoPalco() {
    setModoPalcoAberto(false)
    setRolagemAtiva(false)

    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
  }

  function alternarFavorito(nomeMusica) {
    if (!podeEditar) return
    setMusicas(
      musicas.map((musica) =>
        musica.nome === nomeMusica
          ? {
              ...musica,
              favorito: !musica.favorito
            }
          : musica
      )
    )
  }

  function transporMusicaEditando(passos) {
    setTomMusicaEditando((tomAtual) => transporTom(tomAtual, passos))
    setCifraMusicaEditando((cifraAtual) => transporCifra(cifraAtual, passos))
  }

  function registrarExecucaoRepertorio() {
    if (!podeEditar) return
    const musicasExecutadas = blocos.flatMap((bloco) => bloco.musicas)

    if (musicasExecutadas.length === 0) {
      alert("Este repertório não possui músicas para registrar.")
      return
    }

    const registro = {
      id: Date.now(),
      data: new Date().toISOString(),
      repertorio: repertorioAtual,
      musicas: musicasExecutadas
    }

    setHistoricoExecucoes([registro, ...historicoExecucoes])

    setMusicas(
      musicas.map((musica) =>
        musicasExecutadas.includes(musica.nome)
          ? {
              ...musica,
              execucoes: (musica.execucoes || 0) + 1
            }
          : musica
      )
    )

    alert("Execução registrada com sucesso!")
  }

  const totalBlocos = blocos.length

  const totalMusicasNoRepertorio = blocos.reduce(
    (total, bloco) => total + bloco.musicas.length,
    0
  )

  const totalRepertorios = repertorios.length

  const musicasOrdenadas = [...musicas]
    .filter((musica) => {
  const termo = busca.toLowerCase()

  const correspondeBusca =
    musica.nome?.toLowerCase().includes(termo) ||
    musica.tom?.toLowerCase().includes(termo) ||
    musica.letra?.toLowerCase().includes(termo) ||
    musica.cifra?.toLowerCase().includes(termo) ||
    (musica.tags || []).some((tag) =>
      tag.toLowerCase().includes(termo)
    )

  const correspondeTag =
    tagSelecionada === "Todas" ||
    (musica.tags || []).includes(tagSelecionada)

  return correspondeBusca && correspondeTag
})
const totalFavoritas = musicas.filter((musica) => musica.favorito).length

const totalExecucoes = historicoExecucoes.length

const topMusicasExecutadas = musicas
  .map((musica) => ({
    nome: musica.nome,
    execucoes: historicoExecucoes.filter(
      (item) => item.musica === musica.nome
    ).length
  }))
  .filter((musica) => musica.execucoes > 0)
  .sort((a, b) => b.execucoes - a.execucoes)
  .slice(0, 5)

const tagsMaisUsadas = musicas
  .flatMap((musica) => musica.tags || [])
  .reduce((acc, tag) => {
    acc[tag] = (acc[tag] || 0) + 1
    return acc
  }, {})

const topTags = Object.entries(tagsMaisUsadas)
  .map(([tag, total]) => ({ tag, total }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 5)

const todasTags = [
  "Todas",
  ...new Set(
    musicas.flatMap((musica) => musica.tags || [])
  )
]
useEffect(() => {
  localStorage.setItem("eventos", JSON.stringify(eventos))
}, [eventos])
function criarEvento() {
  if (!podeEditar) return
  if (!nomeEvento.trim()) return

  const novoEvento = {
    id: Date.now(),
    nome: nomeEvento.trim(),
    data: dataEvento,
    horario: horarioEvento,
    local: localEvento.trim(),
    repertorio: repertorioAtual
  }

  setEventos([...eventos, novoEvento])

  setNomeEvento("")
  setDataEvento("")
  setHorarioEvento("")
  setLocalEvento("")
}
function excluirEvento(idEvento) {
  if (!podeExcluir) return
  const confirmar = window.confirm("Deseja excluir este evento?")

  if (!confirmar) return

  setEventos(eventos.filter((evento) => evento.id !== idEvento))
}
function abrirEditarEvento(evento) {
  if (!podeEditar) return
  setEventoEditando(evento)
  setNomeEventoEditando(evento.nome)
  setDataEventoEditando(evento.data)
  setHorarioEventoEditando(evento.horario)
  setLocalEventoEditando(evento.local)
  setRepertorioEventoEditando(evento.repertorio)
  setModalEventoAberto(true)
}

function salvarEventoEditado() {
  if (!podeEditar) return
  if (!eventoEditando || !nomeEventoEditando.trim()) return

  setEventos(
    eventos.map((evento) =>
      evento.id === eventoEditando.id
        ? {
            ...evento,
            nome: nomeEventoEditando.trim(),
            data: dataEventoEditando,
            horario: horarioEventoEditando,
            local: localEventoEditando.trim(),
            repertorio: repertorioEventoEditando
          }
        : evento
    )
  )

  setModalEventoAberto(false)
  setEventoEditando(null)
}
function finalizarEvento(evento) {
  if (!podeEditar) return
  const confirmar = window.confirm(
    `Deseja finalizar o evento "${evento.nome}" e registrar as execuções?`
  )

  if (!confirmar) return

  const repertorio = repertorios.find(
    (rep) => rep.nome === evento.repertorio
  )

  if (!repertorio) {
    alert("Repertório do evento não encontrado.")
    return
  }

  const musicasDoEvento = repertorio.blocos.flatMap(
    (bloco) => bloco.musicas
  )

  if (musicasDoEvento.length === 0) {
    alert("Este repertório não possui músicas.")
    return
  }

  const dataExecucao = new Date().toISOString()

  setMusicas(
    musicas.map((musica) => {
      if (musicasDoEvento.includes(musica.nome)) {
        return {
          ...musica,
          execucoes: (musica.execucoes || 0) + 1
        }
      }

      return musica
    })
  )

  setEventos(
    eventos.map((item) =>
      item.id === evento.id
        ? {
            ...item,
            finalizado: true,
            dataFinalizacao: dataExecucao
          }
        : item
    )
  )

  alert("Evento finalizado e execuções registradas!")
}
function calcularTempoRestante(evento) {
  if (evento.finalizado) {
    return "✔️ Realizado"
  }

  if (!evento.data) {
    return "Sem data"
  }

  const agora = new Date()
  const dataEvento = new Date(`${evento.data}T${evento.horario || "00:00"}`)
  const diferenca = dataEvento - agora

  if (diferenca <= 0) {
    return "⏳ Hoje"
  }

  const dias = Math.floor(diferenca / (1000 * 60 * 60 * 24))

  const horas = Math.floor(
    (diferenca % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  )

  return `${dias}d ${horas}h`
}

useEffect(() => {
  localStorage.setItem("nomeMinisterio", nomeMinisterio)
  localStorage.setItem("logoPersonalizada", logoPersonalizada)
  localStorage.setItem("tituloPDF", tituloPDF)
  localStorage.setItem("rodapePDF", rodapePDF)
}, [nomeMinisterio, tituloPDF, rodapePDF])

const dadosGrafico = musicas
  .map((musica) => ({
    nome: musica.nome,
    execucoes: musica.execucoes || 0
  }))
  .filter((musica) => musica.execucoes > 0)
  .sort((a, b) => b.execucoes - a.execucoes)
  .slice(0, 10)

function alterarLogo(event) {
  const arquivo = event.target.files[0]

  if (!arquivo) return

  const leitor = new FileReader()

  leitor.onload = (e) => {
    setLogoPersonalizada(e.target.result)
  }

  leitor.readAsDataURL(arquivo)
}
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (user) => {
    if (user) {
      setUsuario(user)

      const refUsuario = doc(db, "usuarios", user.uid)
      const snapUsuario = await getDoc(refUsuario)

      if (snapUsuario.exists()) {
        setPerfilUsuario(snapUsuario.data())
      } else {
        const novoPerfil = {
          nome: user.email,
          email: user.email,
          permissao: "visualizador",
          criadoEm: new Date().toISOString()
        }

        await setDoc(refUsuario, novoPerfil)
        setPerfilUsuario(novoPerfil)
      }
    } else {
      setUsuario(null)
      setPerfilUsuario(null)
    }

    setCarregandoLogin(false)
  })

  return () => unsubscribe()
}, [])

useEffect(() => {
  if (!usuario) return

  const refMusicas = collection(db, "musicas")

  const unsubscribe = onSnapshot(refMusicas, (snapshot) => {
    const lista = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...normalizarMusica(docItem.data())
    }))

    setMusicas(lista)
  })

  return () => unsubscribe()
}, [usuario])

async function criarMusicaFirebase() {
  if (!podeEditar) {
    alert("Você não possui permissão para adicionar músicas.")
    return
  }

  if (!novaMusica.trim()) return

  await addDoc(collection(db, "musicas"), {
    nome: novaMusica.trim().toUpperCase(),
    tom: "",
    letra: "",
    cifra: "",
    tags: [],
    favorito: false,
    execucoes: 0,
    criadoEm: new Date().toISOString()
  })

  setNovaMusica("")
} 

useEffect(() => {
  if (!usuario) return

  const ref = doc(db, "dados", "repertorios")

  const unsubscribe = onSnapshot(ref, (snapshot) => {
    if (snapshot.exists()) {
      const dados = snapshot.data()

      if (Array.isArray(dados.repertorios)) {
        setRepertorios(dados.repertorios)

        const atualExiste = dados.repertorios.some(
          (rep) => rep.nome === repertorioAtual
        )

        const repertorioBase = atualExiste
          ? dados.repertorios.find((rep) => rep.nome === repertorioAtual)
          : dados.repertorios[0]

        if (repertorioBase) {
          setRepertorioAtual(repertorioBase.nome)
          setBlocos(repertorioBase.blocos || [])
        }
      }
    }
  })

  return () => unsubscribe()
}, [usuario])
async function salvarRepertoriosFirebase(listaRepertorios = repertorios) {
  if (!podeEditar) {
    alert("Você não possui permissão para sincronizar repertórios.")
    return
  }

  await setDoc(doc(db, "dados", "repertorios"), {
    repertorios: listaRepertorios,
    atualizadoEm: new Date().toISOString()
  })
}




useEffect(() => {
  if (!usuario) return

  const ref = doc(db, "palco", "sessaoAtual")

  const unsubscribe = onSnapshot(ref, (snapshot) => {
    if (snapshot.exists()) {
      setSessaoPalco(snapshot.data())
    }
  })

  return () => unsubscribe()
}, [usuario])

useEffect(() => {
  if (!modoPalcoAberto || !sessaoPalco?.ativo) return

  const indice = sessaoPalco.indiceMusica || 0

  const lista = (sessaoPalco.musicas || []).map((itemMusica) => {
    if (typeof itemMusica === "object" && itemMusica !== null) {
      return normalizarMusica(itemMusica)
    }

    const dadosMusica = musicas.find((m) => m.nome === itemMusica)

    return (
      dadosMusica || {
        nome: itemMusica,
        tom: "",
        letra: "",
        cifra: "",
        tags: [],
        favorito: false,
        execucoes: 0
      }
    )
  })

  if (lista.length === 0) return

  setListaPalco(lista)
  setIndiceMusicaPalco(indice)
  setMusicaPalco(lista[indice] || lista[0])
  setModoPalcoVisualizacao(sessaoPalco.modo || "letra")
}, [sessaoPalco, modoPalcoAberto, musicas])

async function iniciarSessaoPalco() {
  if (!podeControlarPalco) {
    alert("Você não possui permissão para controlar o palco.")
    return
  }

  const musicasDoRepertorio = blocos
    .flatMap((bloco) => bloco.musicas || [])
    .map((nomeMusica) => {
      const dadosMusica = musicas.find((m) => m.nome === nomeMusica)

      return dadosMusica || {
        nome: nomeMusica,
        tom: "",
        letra: "",
        cifra: "",
        tags: [],
        favorito: false,
        execucoes: 0
      }
    })

  if (musicasDoRepertorio.length === 0) {
    alert("Este repertório não possui músicas.")
    return
  }

  await setDoc(doc(db, "palco", "sessaoAtual"), {
    repertorio: repertorioAtual,
    musicas: musicasDoRepertorio,
    indiceMusica: 0,
    modo: "letra",
    mensagemHost: "",
    rolagemAtiva: false,
    velocidadeRolagem: velocidadeRolagem || 1,
    host: perfilUsuario?.nome || usuario.email,
    ativo: true,
    atualizadoEm: new Date().toISOString()
  })

  alert("Sessão de palco iniciada.")
}

useEffect(() => {
  if (!modoPalcoAberto || !sessaoPalco?.ativo) return

  setRolagemAtiva(Boolean(sessaoPalco.rolagemAtiva))
  setVelocidadeRolagem(sessaoPalco.velocidadeRolagem || 1)
}, [sessaoPalco, modoPalcoAberto])
useEffect(() => {
  if (!modoPalcoAberto) return
  if (!sessaoPalco?.comandoRolagem?.momento) return

  const palco = palcoRef.current
  if (!palco) return

  palco.scrollBy({
    top: Number(sessaoPalco.comandoRolagem.direcao || 0),
    behavior: "smooth"
  })
}, [sessaoPalco?.comandoRolagem?.momento, modoPalcoAberto])


useEffect(() => {
  if (!modoPalcoAberto) return
  if (!sessaoPalco?.comandoRolagem?.id) return

  executarRolagemPalco(sessaoPalco.comandoRolagem.direcao)
}, [sessaoPalco?.comandoRolagem?.id])

if (carregandoLogin) {
  return <div className="login-page">Carregando...</div>
}

if (!usuario) {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">🎵</div>

          <h1 className="login-title">
            Repertório Show
          </h1>

          <p className="login-subtitle">
            Entre para acessar o sistema
          </p>
        </div>

        <input
          className="search"
          placeholder="E-mail"
          value={emailLogin}
          onChange={(e) => setEmailLogin(e.target.value)}
        />

        <input
          className="search"
          type="password"
          placeholder="Senha"
          value={senhaLogin}
          onChange={(e) => setSenhaLogin(e.target.value)}
        />

        <button className="btn-primary" onClick={entrarSistema}>
          Entrar
        </button>
      </div>
    </div>
  )
}


async function entrarSistema() {
  if (!emailLogin || !senhaLogin) {
    alert("Digite e-mail e senha.")
    return
  }

  try {
    await signInWithEmailAndPassword(
      auth,
      emailLogin,
      senhaLogin
    )
  } catch (error) {
    alert("Erro ao entrar: " + error.message)
  }
}

async function sairSistema() {
  await signOut(auth)
}

function entrarNaSessaoAoVivo() {
  if (!sessaoPalco?.ativo) {
    alert("Nenhuma sessão de palco ativa.")
    return
  }

  const lista = (sessaoPalco.musicas || []).map((itemMusica) => {
    if (typeof itemMusica === "object" && itemMusica !== null) {
      return normalizarMusica(itemMusica)
    }

    const dadosMusica = musicas.find((m) => m.nome === itemMusica)

    return (
      dadosMusica || {
        nome: itemMusica,
        tom: "",
        letra: "",
        cifra: "",
        tags: [],
        favorito: false,
        execucoes: 0
      }
    )
  })

  const indice = sessaoPalco.indiceMusica || 0

  setListaPalco(lista)
  setIndiceMusicaPalco(indice)
  setMusicaPalco(lista[indice] || lista[0])
  setModoPalcoVisualizacao(sessaoPalco.modo || "letra")
  setModoPalcoAberto(true)
}

async function atualizarSessaoPalco(novosDados) {
  if (!podeControlarPalco) return

  await setDoc(
    doc(db, "palco", "sessaoAtual"),
    {
      ...novosDados,
      atualizadoEm: new Date().toISOString()
    },
    { merge: true }
  )
}

async function proximaMusicaAoVivo() {
  if (!sessaoPalco?.ativo) return

  const total = sessaoPalco.musicas?.length || 0
  if (total === 0) return

  const novoIndice =
    sessaoPalco.indiceMusica >= total - 1
      ? 0
      : sessaoPalco.indiceMusica + 1

  await atualizarSessaoPalco({
    indiceMusica: novoIndice
  })
}

async function musicaAnteriorAoVivo() {
  if (!sessaoPalco?.ativo) return

  const total = sessaoPalco.musicas?.length || 0
  if (total === 0) return

  const novoIndice =
    sessaoPalco.indiceMusica <= 0
      ? total - 1
      : sessaoPalco.indiceMusica - 1

  await atualizarSessaoPalco({
    indiceMusica: novoIndice
  })
}

async function enviarMensagemHost() {
  if (!mensagemHost.trim()) return

  await atualizarSessaoPalco({
    mensagemHost: mensagemHost.trim()
  })
}

async function limparMensagemHost() {
  setMensagemHost("")
  await atualizarSessaoPalco({
    mensagemHost: ""
  })
}
async function moverRolagemAoVivo(valor) {
  if (!podeControlarPalco || !sessaoPalco?.ativo) return

  await atualizarSessaoPalco({
    comandoRolagem: {
      direcao: valor,
      momento: Date.now()
    }
  })
}
function executarRolagemPalco(valor) {
  const palco = document.querySelector(".stage-mode")
  const conteudo = document.querySelector(".stage-content")

  if (palco) {
    palco.scrollBy({ top: valor, behavior: "smooth" })
  }

  if (conteudo) {
    conteudo.scrollBy({ top: valor, behavior: "smooth" })
  }

  window.scrollBy({ top: valor, behavior: "smooth" })
}

async function moverRolagemAoVivo(valor) {
  if (!podeControlarPalco || !sessaoPalco?.ativo) return

  await atualizarSessaoPalco({
    comandoRolagem: {
      id: `${Date.now()}-${Math.random()}`,
      direcao: valor
    }
  })

  executarRolagemPalco(valor)
}



  return (
    
    <div className={temaEscuro ? "app dark" : "app"}>
      {modalConfiguracoesAberto && (
  <div className="modal-overlay">
    <div className="modal" style={{ width: "520px" }}>
      <h2>⚙️ Configurações do Ministério</h2>

      <label>Nome do Ministério</label>
      <input
        className="search"
        value={nomeMinisterio}
        onChange={(e) => setNomeMinisterio(e.target.value)}
      />

      <label>Título padrão do PDF</label>
      <input
        className="search"
        value={tituloPDF}
        onChange={(e) => setTituloPDF(e.target.value)}
      />

      <label>Rodapé do PDF</label>
      <input
        className="search"
        value={rodapePDF}
        onChange={(e) => setRodapePDF(e.target.value)}
      />
      <label>Logo do Ministério</label>

<input
  className="search"
  type="file"
  accept="image/*"
  onChange={alterarLogo}
/>

{logoPersonalizada && (
  <img
    src={logoPersonalizada}
    alt="Logo personalizada"
    style={{
      maxWidth: "180px",
      display: "block",
      marginTop: "10px"
    }}
  />
)}
      <div
        style={{
          marginTop: "20px",
          padding: "16px",
          borderRadius: "12px",
          background: temaEscuro ? "#111827" : "#f8fafc"
        }}
      >
        <h3>Pré-visualização</h3>
        <p><strong>{nomeMinisterio}</strong></p>
        <p>{tituloPDF}</p>
        <small>{rodapePDF}</small>
      </div>

      <div className="modal-actions">
        <button
          className="btn-primary"
          onClick={() => setModalConfiguracoesAberto(false)}
        >
          Salvar
        </button>
      </div>
    </div>
  </div>
)}
      {modoPalcoAberto && musicaPalco && (
        <div
  className="stage-mode"
  ref={palcoRef}
>
          <button className="stage-close" onClick={fecharModoPalco}>
            ×
          </button>

          <div className="stage-content">
            {sessaoPalco?.mensagemHost && (
              <div className="stage-host-message">
                {sessaoPalco.mensagemHost}
              </div>
            )}

            <h1>{musicaPalco.nome}</h1>

            {musicaPalco.tom && <h2>Tom: {musicaPalco.tom}</h2>}

            <div className="stage-view-toggle">
              <button
  onClick={() => {
    setModoPalcoVisualizacao("letra")

    if (podeControlarPalco && sessaoPalco?.ativo) {
      atualizarSessaoPalco({ modo: "letra" })
    }
  }}
>
  👁️ Letra
</button>

<button
  onClick={() => {
    setModoPalcoVisualizacao("cifra")

    if (podeControlarPalco && sessaoPalco?.ativo) {
      atualizarSessaoPalco({ modo: "cifra" })
    }
  }}
>
  🎸 Cifra
</button>
            </div>

            <pre
              className={
                modoPalcoVisualizacao === "cifra" ? "stage-chords" : ""
              }
            >
              {modoPalcoVisualizacao === "letra"
                ? musicaPalco.letra || "Nenhuma letra cadastrada."
                : musicaPalco.cifra || "Nenhuma cifra cadastrada."}
            </pre>

            

<div className="stage-shortcuts">
  ⬅️ Anterior | ➡️ Próxima | Espaço = Pausar | + = Mais rápido | - =
  Mais lento | Esc = Fechar
</div>

<div className="stage-navigation">
  <button
    onClick={() =>
      sessaoPalco?.ativo
        ? musicaAnteriorAoVivo()
        : musicaAnteriorPalco()
    }
  >
    ◀ Anterior
  </button>

  <span>
    {indiceMusicaPalco + 1} / {listaPalco.length}
  </span>

  <button
    onClick={() =>
      sessaoPalco?.ativo
        ? proximaMusicaAoVivo()
        : proximaMusicaPalco()
    }
  >
    Próxima ▶
  </button>
</div>

{podeControlarPalco && sessaoPalco?.ativo && (
  <div className="stage-host-panel">
    <h3>🎛 Controle do Host</h3>
  <div className="stage-navigation">
  <button onClick={musicaAnteriorAoVivo}>◀ Música</button>
  <button onClick={proximaMusicaAoVivo}>Música ▶</button>
</div>

<div className="stage-navigation">
  <button onClick={() => atualizarSessaoPalco({ modo: "letra" })}>
    👁️ Letra
  </button>

  <button onClick={() => atualizarSessaoPalco({ modo: "cifra" })}>
    🎸 Cifra
  </button>
</div>  
    <div className="stage-navigation">
 <button onClick={() => moverRolagemAoVivo(-300)}>
  ⬆ Subir
</button>

<button onClick={() => moverRolagemAoVivo(300)}>
  ⬇ Descer
</button>
</div>
<div className="stage-controls">

               {rolagemAtiva ? "⏸ Pausar" : "▶ Iniciar"}



              <button

  onClick={() => {

    const novaVelocidade = Math.max(1, velocidadeRolagem - 1)



    setVelocidadeRolagem(novaVelocidade)



    if (podeControlarPalco && sessaoPalco?.ativo) {

      atualizarSessaoPalco({

        velocidadeRolagem: novaVelocidade

      })

    }

  }}

>

  ➖

</button>



<span>Velocidade: {velocidadeRolagem}</span>



<button

  onClick={() => {

    const novaVelocidade = velocidadeRolagem + 1



    setVelocidadeRolagem(novaVelocidade)



    if (podeControlarPalco && sessaoPalco?.ativo) {

      atualizarSessaoPalco({

        velocidadeRolagem: novaVelocidade

      })

    }

  }}

>

  ➕

</button>

           </div>
    <div className="stage-message-box">
      <textarea
  value={mensagemHost}
  onChange={(e) => setMensagemHost(e.target.value)}
  onKeyDown={(e) => e.stopPropagation()}
  placeholder="Mensagem para a banda"
/>

      <button onClick={enviarMensagemHost}>
        Enviar
      </button>

      <button onClick={limparMensagemHost}>
        Limpar
      </button>
    </div>
    
  </div>
)}

            {listaPalco[indiceMusicaPalco + 1] && (
              <div className="stage-next">
                Próxima: {listaPalco[indiceMusicaPalco + 1].nome}
              </div>
            )}
          </div>
        </div>
      )}
{modalEventoAberto && (
  <div className="modal-overlay">
    <div className="modal" style={{ width: "520px" }}>
      <h2>Editar evento</h2>

      <input
        className="search"
        placeholder="Nome do evento"
        value={nomeEventoEditando}
        onChange={(e) => setNomeEventoEditando(e.target.value)}
      />

      <input
        className="search"
        type="date"
        value={dataEventoEditando}
        onChange={(e) => setDataEventoEditando(e.target.value)}
      />

      <input
        className="search"
        type="time"
        value={horarioEventoEditando}
        onChange={(e) => setHorarioEventoEditando(e.target.value)}
      />

      <input
        className="search"
        placeholder="Local"
        value={localEventoEditando}
        onChange={(e) => setLocalEventoEditando(e.target.value)}
      />

      <select
        className="search"
        value={repertorioEventoEditando}
        onChange={(e) => setRepertorioEventoEditando(e.target.value)}
      >
        {repertorios.map((rep) => (
          <option key={rep.nome} value={rep.nome}>
            {rep.nome}
          </option>
        ))}
      </select>

      <div className="modal-actions">
        <button
          className="btn-light"
          onClick={() => setModalEventoAberto(false)}
        >
          Cancelar
        </button>

        <button className="btn-primary" onClick={salvarEventoEditado}>
          Salvar
        </button>
      </div>
    </div>
  </div>
)}

      {modalEditarAberto && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Renomear bloco</h2>

            <input
              value={novoNomeBloco}
              onChange={(e) => setNovoNomeBloco(e.target.value)}
              className="search"
              autoFocus
            />

            <label
              style={{ fontWeight: "bold", marginTop: "12px", display: "block" }}
            >
              Cor do bloco
            </label>

            <select
              className="search"
              value={corBlocoEditando}
              onChange={(e) => setCorBlocoEditando(e.target.value)}
            >
              <option value="green">Verde</option>
              <option value="blue">Azul</option>
              <option value="orange">Laranja</option>
              <option value="purple">Roxo</option>
              <option value="red">Vermelho</option>
            </select>

            <div className="modal-actions">
              <button
                className="btn-light"
                onClick={() => setModalEditarAberto(false)}
              >
                Cancelar
              </button>

              <button className="btn-primary" onClick={salvarNovoNomeBloco}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEditarRepertorioAberto && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Renomear repertório</h2>

            <input
              value={novoNomeRepertorio}
              onChange={(e) => setNovoNomeRepertorio(e.target.value)}
              className="search"
              autoFocus
            />

            <div className="modal-actions">
              <button
                className="btn-light"
                onClick={() => setModalEditarRepertorioAberto(false)}
              >
                Cancelar
              </button>

              <button
                className="btn-primary"
                onClick={salvarNovoNomeRepertorio}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalMusicaAberto && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: "620px" }}>
            <h2>Editar música</h2>

            <input
              className="search"
              value={nomeMusicaEditando}
              onChange={(e) => setNomeMusicaEditando(e.target.value)}
            />

            <div style={{ display: "flex", gap: "10px" }}>
              <input
                className="search"
                placeholder="Tom (Ex: G, A, C#m)"
                value={tomMusicaEditando}
                onChange={(e) => setTomMusicaEditando(e.target.value)}
                style={{ flex: 1 }}
              />

              <button
                className="btn-light"
                onClick={() => transporMusicaEditando(-1)}
              >
                -1
              </button>

              <button
                className="btn-light"
                onClick={() => transporMusicaEditando(1)}
              >
                +1
              </button>
            </div>

            <textarea
              className="search"
              placeholder="Letra da música"
              value={letraMusicaEditando}
              onChange={(e) => setLetraMusicaEditando(e.target.value)}
              style={{
                minHeight: "160px",
                resize: "vertical"
              }}
            />

            <textarea
              className="search"
              placeholder="Cifra da música"
              value={cifraMusicaEditando}
              onChange={(e) => setCifraMusicaEditando(e.target.value)}
              style={{
                minHeight: "160px",
                resize: "vertical"
              }}
            />

            <input
              className="search"
              placeholder="Tags separadas por vírgula. Ex: Louvor, Entrada, Animada"
              value={tagsMusicaEditando}
              onChange={(e) => setTagsMusicaEditando(e.target.value)}
            />

            <div className="modal-actions">
              <button
                className="btn-light"
                onClick={() => setModalMusicaAberto(false)}
              >
                Cancelar
              </button>

              <button className="btn-primary" onClick={salvarMusica}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalLetraAberto && musicaVisualizando && (
        <div className="modal-overlay">
          <div className="modal" style={{ width: "560px" }}>
            <h2>{musicaVisualizando.nome}</h2>

            {musicaVisualizando.tom && (
              <p>
                <strong>Tom:</strong> {musicaVisualizando.tom}
              </p>
            )}

            <p style={{ color: "#64748b", marginTop: 0 }}>
              Execuções registradas: {musicaVisualizando.execucoes || 0}
            </p>

            {musicaVisualizando.tags?.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginBottom: "15px"
                }}
              >
                {musicaVisualizando.tags.map((tag, index) => (
                  <span
                    key={index}
                    style={{
                      background: "#ddd6fe",
                      color: "#5b21b6",
                      padding: "4px 10px",
                      borderRadius: "999px",
                      fontSize: "12px",
                      fontWeight: "bold"
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "15px"
              }}
            >
              <button
                className="btn-light"
                onClick={() => setModoVisualizacao("letra")}
              >
                👁️ Letra
              </button>

              <button
                className="btn-light"
                onClick={() => setModoVisualizacao("cifra")}
              >
                🎸 Cifra
              </button>
            </div>

            <div
              className={modoVisualizacao === "cifra" ? "chord-view" : ""}
              style={{
                whiteSpace: "pre-wrap",
                background: "#f8fafc",
                padding: "16px",
                borderRadius: "12px",
                maxHeight: "400px",
                overflowY: "auto",
                lineHeight: "1.6"
              }}
            >
              {modoVisualizacao === "letra"
                ? musicaVisualizando.letra || "Nenhuma letra cadastrada."
                : musicaVisualizando.cifra || "Nenhuma cifra cadastrada."}
            </div>

            <div className="modal-actions">
              <button
                className="btn-light"
                onClick={() => setModalLetraAberto(false)}
              >
                Fechar
              </button>

              <button
                className="btn-primary"
                onClick={() => abrirModoPalco(musicaVisualizando)}
              >
                🎤 Modo Palco
              </button>
            </div>
          </div>
        </div>
      )}

      {modalExcluirAberto && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirmar exclusão</h2>

            <p>
              Deseja excluir o bloco <strong>{itemExcluindo}</strong>?
            </p>

            <div className="modal-actions">
              <button
                className="btn-light"
                onClick={() => setModalExcluirAberto(false)}
              >
                Cancelar
              </button>

              <button
                onClick={confirmarExclusao}
                style={{
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div className="logo">🎵 Meu Repertório</div>

        <div className="menu-item active">📋 Repertório</div>
        <div className="menu-item">🎶 Músicas</div>
        <div className="menu-item">📦 Blocos</div>
        {podeExcluir && (
          <div
            className="menu-item"
            onClick={() => setModalConfiguracoesAberto(true)}
          >
            ⚙️ Configurações
          </div>
        )}
      </aside>

      <main className="content">
        <div className="topbar">
          {podeControlarPalco && (
  <button className="btn-primary" onClick={iniciarSessaoPalco}>
    🎤 Iniciar palco ao vivo
  </button>
)}
{sessaoPalco?.ativo && (
  <button className="btn-light" onClick={entrarNaSessaoAoVivo}>
    👥 Entrar no palco ao vivo
  </button>
)}
          {podeEditar && (
  <button
    className="btn-light"
    onClick={() => salvarRepertoriosFirebase()}
  >
    Sincronizar repertórios
  </button>
)}
        <div
          style={{
            padding: "8px 12px",
            background: "#1e293b",
            color: "white",
            borderRadius: "10px",
            fontSize: "14px",
            fontWeight: "bold"
          }}
        >
          {perfilUsuario?.permissao?.toUpperCase()}
        </div>

        <button className="btn-light" onClick={sairSistema}>
          Sair
        </button>
          <button
            className="btn-light"
            onClick={() => setTemaEscuro(!temaEscuro)}
          >
            {temaEscuro ? "☀️ Claro" : "🌙 Escuro"}
          </button>

          <button className="btn-light" onClick={exportarPDF}>
            Exportar PDF
          </button>

          <button className="btn-light" onClick={compartilharRepertorio}>
            Compartilhar
          </button>

          {podeEditar && (
            <button className="btn-primary" onClick={registrarExecucaoRepertorio}>
              Registrar execução
            </button>
          )}

          {podeEditar && (
  <>
    <button className="btn-light" onClick={exportarBackupJSON}>
      Backup JSON
    </button>

    <label className="btn-light" style={{ cursor: "pointer" }}>
      Restaurar JSON
      <input
        type="file"
        accept="application/json"
        onChange={importarBackupJSON}
        style={{ display: "none" }}
      />
    </label>
  </>
)}
        </div>

        <div className="stats">
  <div className="stat-card">
    <div className="stat-icon">🎵</div>
    <div>
      <strong>{musicas.length}</strong>
      <span>Músicas cadastradas</span>
    </div>
  </div>

  <div className="stat-card">
    <div className="stat-icon">⭐</div>
    <div>
      <strong>{totalFavoritas}</strong>
      <span>Favoritas</span>
    </div>
  </div>

  <div className="stat-card">
    <div className="stat-icon">📋</div>
    <div>
      <strong>{totalRepertorios}</strong>
      <span>Repertórios</span>
    </div>
  </div>

  <div className="stat-card">
    <div className="stat-icon">🎤</div>
    <div>
      <strong>{totalExecucoes}</strong>
      <span>Execuções</span>
    </div>
  </div>
</div>
<div className="dashboard-grid">
  <div className="dashboard-card" style={{ marginBottom: "20px" }}>
  <h3>📈 Top 10 músicas executadas</h3>

  <div style={{ width: "100%", height: 320 }}>
    <ResponsiveContainer>
      <BarChart data={dadosGrafico}>
        <XAxis dataKey="nome" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="execucoes" />
      </BarChart>
    </ResponsiveContainer>
  </div>
</div>
  <div className="dashboard-card">
    <h3>🏆 Top músicas executadas</h3>

    {topMusicasExecutadas.length === 0 ? (
      <p>Nenhuma execução registrada.</p>
    ) : (
      topMusicasExecutadas.map((item, index) => (
        <div className="dashboard-row" key={item.nome}>
          <span>{index + 1}. {item.nome}</span>
          <strong>{item.execucoes}</strong>
        </div>
      ))
    )}
  </div>

  <div className="dashboard-card">
    <h3>🏷️ Tags mais usadas</h3>

    {topTags.length === 0 ? (
      <p>Nenhuma tag cadastrada.</p>
    ) : (
      topTags.map((item) => (
        <div className="dashboard-row" key={item.tag}>
          <span>{item.tag}</span>
          <strong>{item.total}</strong>
        </div>
      ))
    )}
  </div>
</div>
<div className="dashboard-card" style={{ marginBottom: "20px" }}>
  <h3>📅 Agenda de Eventos</h3>

  {podeEditar && (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr 1fr 2fr auto",
        gap: "10px",
        marginBottom: "15px"
      }}
    >
      <input
        className="search"
        placeholder="Nome do evento"
        value={nomeEvento}
        onChange={(e) => setNomeEvento(e.target.value)}
        style={{ margin: 0 }}
      />

      <input
        className="search"
        type="date"
        value={dataEvento}
        onChange={(e) => setDataEvento(e.target.value)}
        style={{ margin: 0 }}
      />

      <input
        className="search"
        type="time"
        value={horarioEvento}
        onChange={(e) => setHorarioEvento(e.target.value)}
        style={{ margin: 0 }}
      />

      <input
        className="search"
        placeholder="Local"
        value={localEvento}
        onChange={(e) => setLocalEvento(e.target.value)}
        style={{ margin: 0 }}
      />

      <button className="btn-primary" onClick={criarEvento}>
        +
      </button>
    </div>
  )}

  {eventos.length === 0 ? (
    <p>Nenhum evento cadastrado.</p>
  ) : (
   [...eventos]
  .sort((a, b) => {
    const dataA = new Date(`${a.data || "9999-12-31"}T${a.horario || "00:00"}`)
    const dataB = new Date(`${b.data || "9999-12-31"}T${b.horario || "00:00"}`)

    return dataA - dataB
  })
  .map((evento) => (
      <div className="dashboard-row" key={evento.id}>
        <span>
          <strong>{evento.nome}</strong>
          <br />
          {evento.data} {evento.horario} — {evento.local}
          
          <br />
          Repertório: {evento.repertorio}
        </span>
        
<br />
<span
  style={{
    color: "#f59e0b",
    fontWeight: "bold"
  }}
  
>
  ⏳ {calcularTempoRestante(evento)}
</span>
        {podeEditar && (
          <button
            className="btn-light"
            onClick={() => finalizarEvento(evento)}
            style={{
              background: evento.finalizado ? "#16a34a" : "#dcfce7",
              color: evento.finalizado ? "white" : "#166534",
              fontWeight: "bold"
            }}
          >
            {evento.finalizado ? "Finalizado" : "✔️ Finalizar"}
          </button>
        )}

        {podeEditar && (
          <button
            className="btn-light"
            onClick={() => abrirEditarEvento(evento)}
          >
            ✏️
          </button>
        )}

        {podeExcluir && (
          <button
            className="btn-light"
            onClick={() => excluirEvento(evento.id)}
            style={{
              background: "#ef4444",
              color: "white"
            }}
          >
            🗑️
          </button>
        )}

       <button
  className="btn-light"
  onClick={() => {
    const nomeRep = evento.repertorio

    setRepertorioAtual(nomeRep)

    const repertorioEncontrado = repertorios.find(
      (rep) => rep.nome === nomeRep
    )

    if (repertorioEncontrado) {
      setBlocos(repertorioEncontrado.blocos || [])
    }

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth"
    })
  }}
>
  Abrir repertório
</button>
      </div>
    ))
  )}
</div>

        <div className="workspace">
          <section className="card">
            <div className="card-header">
              <h2>Todas as músicas</h2>
              <span className="badge">{musicas.length}</span>
            </div>

            <input
              className="search"
              placeholder="Pesquisar música..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <div className="tag-filters">
  {todasTags.map((tag) => (
    <button
      key={tag}
      onClick={() => setTagSelecionada(tag)}
      className={
        tagSelecionada === tag
          ? "tag-filter active"
          : "tag-filter"
      }
    >
      {tag}
    </button>
  ))}
</div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
  <input
    className="search"
    placeholder="Digite o nome da nova música"
    value={novaMusica}
    onChange={(e) => setNovaMusica(e.target.value)}
    style={{ margin: 0 }}
  />

  <button
    className="btn-primary"
    onClick={criarMusicaFirebase}
  >
    +
  </button>
              </div>
          

            <select
              className="search"
              value={blocoSelecionado}
              onChange={(e) => setBlocoSelecionado(e.target.value)}
            >
              {blocos.map((bloco, index) => (
                <option key={index} value={bloco.nome}>
                  {bloco.nome}
                </option>
              ))}
            </select>

            {musicasOrdenadas.map((musica, index) => (
              <div className="song-row" key={index}>
                <div>
  <span className="song-title">
    {musica.nome}
    {musica.tom && ` (${musica.tom})`}
  </span>

  {musica.tags?.length > 0 && (
    <div
      style={{
        display: "flex",
        gap: "4px",
        flexWrap: "wrap",
        marginTop: "4px"
      }}
    >
      {musica.tags.map((tag, index) => (
        <span
          key={index}
          style={{
            background: "#ddd6fe",
            color: "#5b21b6",
            padding: "2px 8px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: "bold"
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  )}
</div>  
                <div style={{ display: "flex", gap: "8px" }}>
                  {podeEditar && (
                    <button
                      className="add-btn"
                      onClick={() => adicionarMusicaAoBloco(musica.nome)}
                    >
                      +
                    </button>
                  )}

                  {podeEditar && (
                    <button
                      onClick={() => alternarFavorito(musica.nome)}
                      style={{
                        background: musica.favorito ? "#facc15" : "#f1f5f9",
                        color: "#111827",
                        border: "none",
                        borderRadius: "10px",
                        width: "40px",
                        height: "40px",
                        cursor: "pointer"
                      }}
                    >
                      ⭐
                    </button>
                  )}
                  {podeEditar && (
                  <button
                    onClick={() => editarMusica(musica)}
                    style={{
                       background: "#e5e7eb",
      color: "#111827",
      border: "none",
      borderRadius: "10px",
      width: "40px",
      height: "40px",
      cursor: "pointer"
                    }}
                  >
                    ✏️
                  </button>
                  )}

                  <button
                    onClick={() => visualizarLetra(musica)}
                    style={{
                      background: "#ecfeff",
                      color: "#0e7490",
                      border: "none",
                      borderRadius: "10px",
                      width: "40px",
                      height: "40px",
                      cursor: "pointer"
                    }}
                  >
                    👁️
                  </button>
          {podeExcluir && (
  <button
    className="delete-btn"
    onClick={() => excluirMusica(musica.nome)}
  >
    🗑️
  </button>
)}
                </div>
              </div>
            ))}
          </section>

          <section className="card">
            <div
              style={{
                marginBottom: "20px",
                padding: "15px",
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                background: temaEscuro ? "#0f172a" : "#fafafa"
              }}
            >
              <h3 style={{ marginBottom: "10px" }}>Repertórios</h3>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  marginBottom: "10px"
                }}
              >
                <select
                  className="search"
                  value={repertorioAtual}
                  onChange={(e) => setRepertorioAtual(e.target.value)}
                  style={{ flex: 1, margin: 0 }}
                >
                  {repertorios.map((rep, index) => (
                    <option key={index} value={rep.nome}>
                      {rep.nome}
                    </option>
                  ))}
                </select>

                {podeEditar && (
                  <button
                    onClick={duplicarRepertorio}
                    style={{
                      background: "#dbeafe",
                      color: "#1e40af",
                      border: "none",
                      borderRadius: "8px",
                      padding: "0 14px",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                  >
                    📄
                  </button>
                )}

                {podeEditar && (
                  <button
                    onClick={abrirEditarRepertorio}
                    style={{
                      background: "#e5e7eb",
                      color: "#111827",
                      border: "none",
                      borderRadius: "8px",
                      padding: "0 14px",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                  >
                    ✏️
                  </button>
                )}

                {podeExcluir && (
                  <button
                    onClick={excluirRepertorio}
                    style={{
                      background: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      padding: "0 14px",
                      cursor: "pointer",
                      fontWeight: "bold"
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>

              {podeEditar && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <input
                    className="search"
                    placeholder="Novo repertório"
                    value={novoRepertorio}
                    onChange={(e) => setNovoRepertorio(e.target.value)}
                    style={{
                      flex: 1,
                      margin: 0
                    }}
                  />

                  <button className="btn-primary" onClick={criarRepertorio}>
                    +
                  </button>
                </div>
              )}
            </div>

            <div className="card-header">
              <h2>Repertório do Show</h2>

              {podeEditar && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    placeholder="Novo bloco"
                    value={novoBloco}
                    onChange={(e) => setNovoBloco(e.target.value)}
                    style={{
                      padding: "10px",
                      borderRadius: "8px",
                      border: "1px solid #ddd"
                    }}
                  />

                  <button className="btn-light" onClick={criarBloco}>
                    +
                  </button>
                </div>
              )}
            </div>

            <DndContext collisionDetection={closestCenter} onDragEnd={aoSoltar}>
              <SortableContext
                items={blocos.map((bloco) => `bloco|||${bloco.nome}`)}
                strategy={rectSortingStrategy}
              >
                {blocos.map((bloco, index) => (
                  <BlocoArrastavel key={bloco.nome} bloco={bloco}>
                    {({ setNodeRef, style, attributes, listeners }) => (
                      <div
                        ref={setNodeRef}
                        style={style}
                        className={`block ${bloco.cor}`}
                      >
                        <div className="block-header">
                          <div className="block-title">
                            <span
                              {...attributes}
                              {...listeners}
                              style={{
                                cursor: "grab",
                                marginRight: "8px",
                                userSelect: "none"
                              }}
                            >
                              ☰
                            </span>

                            {index + 1}. {bloco.nome}

                            {podeEditar && (
                              <button
                                onClick={() => renomearBloco(bloco.nome)}
                                style={{
                                  marginLeft: "10px",
                                  background: "#e5e7eb",
                                  color: "#111827",
                                  border: "none",
                                  borderRadius: "6px",
                                  padding: "4px 8px",
                                  cursor: "pointer"
                                }}
                              >
                                editar
                              </button>
                            )}

                            {podeExcluir && (
                              <button
                                onClick={() => excluirBloco(bloco.nome)}
                                style={{
                                  marginLeft: "6px",
                                  background: "#ef4444",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  padding: "4px 8px",
                                  cursor: "pointer"
                                }}
                              >
                                excluir
                              </button>
                            )}
                          </div>

                          <div className="block-count">
                            {bloco.musicas.length} músicas
                          </div>
                        </div>

                        <SortableContext
                          items={bloco.musicas.map(
                            (musica, index) =>
                              `${bloco.nome}|||${index}|||${musica}`
                          )}
                          strategy={verticalListSortingStrategy}
                        >
                          {bloco.musicas.map((musica, index) => (
                            <MusicaArrastavel
                              key={`${bloco.nome}|||${index}|||${musica}`}
                              musica={musica}
                              textoExibicao={formatarMusicaParaExibir(musica)}
                              index={index}
                              bloco={bloco}
                              removerDoBloco={removerDoBloco}
                              podeEditar={podeEditar}
                            />
                          ))}
                        </SortableContext>
                      </div>
                    )}
                  </BlocoArrastavel>
                ))}
              </SortableContext>
            </DndContext>
          </section>
        </div>
      </main>
    </div>
  )
}

export default App
