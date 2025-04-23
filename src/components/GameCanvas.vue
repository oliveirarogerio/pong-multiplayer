<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import gameManager from '../game/GameManager'; // Assumindo que gameManager tem tipos exportados ou pode ser tipado
import particleService from '../services/ParticleService';
import { GameStatus, GameState, PowerUpType } from '../types'; // Mantendo seus tipos existentes
import webRTCService from '../services/WebRTCService';
import { ConnectionStatus } from '../types'; // Implied import for ConnectionStatus

// --- Constantes ---
const CANVAS_BG_COLOR = '#121212';
const CENTER_LINE_COLOR = '#333333';
const SCORE_COLOR = '#999999';
const PADDLE_DEFAULT_COLOR = '#FFFFFF';
const PADDLE_ENLARGE_COLOR = '#33FF57'; // Verde para raquete aumentada
const PADDLE_SHRUNK_COLOR = '#FF5733'; // Vermelho para raquete diminuída
const PADDLE_TRAIL_COLOR = '#80C4FF';
const BALL_DEFAULT_COLOR = '#FFFFFF';
const BALL_FAST_COLOR_END = '#FF5733'; // Cor externa do gradiente para bolas rápidas
const BALL_CURVE_COLOR = '#4CAF50'; // Verde para efeito de curva
const TURBO_EFFECT_COLOR_1 = 'rgba(255, 50, 50, 0.3)';
const TURBO_EFFECT_COLOR_2 = 'rgba(255, 150, 50, 0.2)';
const TURBO_TEXT_COLOR = '#FF5733';
const OVERLAY_BG_COLOR = 'rgba(0, 0, 0, 0.7)';
const OVERLAY_TEXT_COLOR = '#FFFFFF';
const DEBUG_BG_COLOR = 'rgba(0, 0, 0, 0.7)';
const DEBUG_TEXT_COLOR = '#FFFFFF';

const PLAYER_ID = 'player';
const OPPONENT_ID = 'opponent';

// --- Interfaces (Definições básicas - ajuste conforme sua implementação real) ---
interface Vector2D {
  x: number;
  y: number;
}

interface Paddle {
  position: Vector2D;
  width: number;
  height: number;
  isMovingUp?: boolean; // Opcional, dependendo da sua lógica
  isMovingDown?: boolean; // Opcional, dependendo da sua lógica
  isRebounding?: boolean; // Opcional, dependendo da sua lógica
  // Adicione outras propriedades se necessário
}

interface Ball {
  position: Vector2D;
  velocity: Vector2D;
  radius: number;
  speedScaleFactor?: number; // Opcional
  curveIntensity?: number;   // Opcional
  curveDirection?: number;   // Opcional
  // Adicione outras propriedades se necessário
}

// Assumindo que GameState já inclui tipos para playerPaddle, opponentPaddle, ball, etc.
// Se não, você pode definí-los aqui ou importá-los.
// Exemplo:
// interface GameState {
//   // ... outras propriedades
//   playerPaddle: Paddle;
//   opponentPaddle: Paddle;
//   ball: Ball;
//   additionalBalls?: Ball[];
//   activePowerUps?: ActivePowerUp[]; // Use o tipo real se tiver
//   // ...
// }

// --- Props ---
const props = defineProps<{
  width: number; // Largura lógica do campo de jogo
  height: number; // Altura lógica do campo de jogo
}>();

// --- Template refs ---
const canvasRef = ref<HTMLCanvasElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);

// --- State ---
// Usando o tipo GameState importado
const gameState = ref<GameState>(gameManager.getGameState());
const debugEnabled = ref<boolean>(false); // Inicializado como false, definido em onMounted

// --- Lógica de Renderização Principal ---
function render() {
  const canvas = canvasRef.value;
  if (!canvas) {
    console.warn('Canvas not available for rendering.');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('Failed to get 2D context from canvas.');
    return;
  }

  try {
    // Get the latest game state
    const state = gameManager.getGameState();
    gameState.value = state;

    // Clear Canvas with error handling
    try {
      ctx.fillStyle = CANVAS_BG_COLOR;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } catch (error) {
      console.error('Error clearing canvas:', error);
      return;
    }

    // Draw game elements with error handling
    try {
      drawCenterLine(ctx, canvas.width, canvas.height);
      drawScores(ctx, state, canvas.width);

      if (state.config.enablePowerUps && typeof (gameManager as any).drawPowerUps === 'function') {
        (gameManager as any).drawPowerUps(ctx);
      }

      drawPaddle(ctx, state.playerPaddle, state, true);
      drawPaddle(ctx, state.opponentPaddle, state, false);
      drawBall(ctx, state.ball);

      if (state.additionalBalls) {
        for (const ball of state.additionalBalls) {
          drawBall(ctx, ball);
        }
      }

      if (state.turboModeActive) {
        drawTurboModeEffect(ctx, canvas);
      }

      if (particleService.isParticlesEnabled()) {
        particleService.update(1 / 60);
        particleService.draw(ctx);
      }

      drawGameStatusOverlays(ctx, state, canvas);

      if (debugEnabled.value) {
        drawDebugInfo(ctx, state);
      }
    } catch (error) {
      console.error('Error during game rendering:', error);
    }
  } catch (error) {
    console.error('Critical error during render:', error);
  }
}

// --- Funções Auxiliares de Desenho ---

function drawCenterLine(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) {
  ctx.save(); // Isola o estado do contexto
  ctx.strokeStyle = CENTER_LINE_COLOR;
  ctx.setLineDash([5, 10]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(canvasWidth / 2, 0);
  ctx.lineTo(canvasWidth / 2, canvasHeight);
  ctx.stroke();
  ctx.restore(); // Restaura o estado anterior (remove setLineDash, etc.)
}

function drawScores(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number) {
  ctx.save();
  ctx.font = '32px sans-serif';
  ctx.fillStyle = SCORE_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText(state.playerScore.toString(), canvasWidth / 4, 50);
  ctx.fillText(state.opponentScore.toString(), (canvasWidth / 4) * 3, 50);
  ctx.restore();
}

/**
 * Desenha uma raquete com efeitos visuais apropriados.
 * @param ctx Contexto de renderização 2D.
 * @param paddle Objeto Paddle a ser desenhado.
 * @param state O estado atual do jogo (para verificar power-ups).
 * @param isPlayer Indica se esta é a raquete do jogador local.
 */
function drawPaddle(ctx: CanvasRenderingContext2D, paddle: Paddle, state: GameState, isPlayer: boolean) {
  ctx.save(); // Isola o estado para esta raquete

  const x = paddle.position.x - paddle.width / 2;
  const y = paddle.position.y - paddle.height / 2;
  const width = paddle.width;
  const height = paddle.height;

  const paddleOwner = isPlayer ? PLAYER_ID : OPPONENT_ID;
  let paddleColor = PADDLE_DEFAULT_COLOR;
  let applyPulse = false;

  // Verifica power-ups ativos que afetam esta raquete
  if (state.activePowerUps && state.config.enablePowerUps) {
    const hasEnlarge = state.activePowerUps.some(p =>
      p.type === PowerUpType.ENLARGE_PADDLE && p.affectsPlayer === paddleOwner);

    // O power-up SHRINK_OPPONENT afeta o *outro* jogador
    const hasShrink = state.activePowerUps.some(p =>
      p.type === PowerUpType.SHRINK_OPPONENT && p.affectsPlayer !== paddleOwner);

    if (hasEnlarge) {
      paddleColor = PADDLE_ENLARGE_COLOR;
      // Efeito de brilho simples (pode ser melhorado)
      ctx.shadowBlur = 10;
      ctx.shadowColor = PADDLE_ENLARGE_COLOR;
    } else if (hasShrink) {
      paddleColor = PADDLE_SHRUNK_COLOR;
      applyPulse = true; // Ativa o efeito de pulsação
    }
  }

  // Aplica efeito de pulsação se necessário
  if (applyPulse) {
    const pulse = 0.7 + 0.3 * Math.sin(Date.now() / 100);
    ctx.globalAlpha = pulse;
  } else {
     ctx.globalAlpha = 1.0; // Garante que alpha está normal
  }

  // Desenha a raquete
  ctx.fillStyle = paddleColor;
  ctx.fillRect(x, y, width, height);

  // Limpa efeitos de sombra e alpha para não afetar outros desenhos
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1.0;

  // Desenha rastro de movimento (se aplicável)
  if (paddle.isMovingUp || paddle.isMovingDown || paddle.isRebounding) {
    drawPaddleTrail(ctx, paddle, x, y, width, height);
  }

  ctx.restore(); // Restaura o estado do contexto
}

function drawPaddleTrail(ctx: CanvasRenderingContext2D, paddle: Paddle, x: number, y: number, width: number, height: number) {
  ctx.save();
  const trailLength = 5;
  const direction = paddle.isMovingUp ? -1 : 1; // Assume que isMovingDown ou isRebounding implicam direção para baixo se não for up
  const speed = paddle.isRebounding ? 8 : 4; // Velocidade do rastro

  ctx.fillStyle = PADDLE_TRAIL_COLOR;
  for (let i = 1; i <= trailLength; i++) {
    const trailY = y - (direction * speed * i); // O rastro fica *atrás* do movimento
    ctx.globalAlpha = 0.3 * (1 - i / trailLength); // Desvanece o rastro
    ctx.fillRect(x, trailY, width, height);
  }
  ctx.restore();
}

/**
 * Desenha uma bola com efeitos visuais apropriados.
 * @param ctx Contexto de renderização 2D.
 * @param ball Objeto Ball a ser desenhado.
 */
function drawBall(ctx: CanvasRenderingContext2D, ball: Ball) {
  ctx.save(); // Isola o estado para esta bola

  // Posição e raio
  const { x, y } = ball.position;
  const { radius } = ball;

  // Desenho básico da bola
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  // Cor baseada na velocidade
  const speedFactor = ball.speedScaleFactor ?? 1.0; // Usa 1.0 se undefined
  if (speedFactor > 1.5) {
    // Gradiente para bolas rápidas
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, BALL_DEFAULT_COLOR); // Centro branco
    gradient.addColorStop(1, BALL_FAST_COLOR_END); // Borda colorida
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = BALL_DEFAULT_COLOR; // Cor padrão
  }
  ctx.fill();

  // Efeito de Motion Blur para bolas rápidas
  if (speedFactor > 1.2 && ball.velocity) {
    drawBallMotionBlur(ctx, ball);
  }

  // Visualização da Curva (se aplicável)
  if (ball.curveIntensity && ball.curveIntensity > 0) {
    drawBallCurveEffect(ctx, ball);
  }

  ctx.restore(); // Restaura o estado do contexto
}

function drawBallMotionBlur(ctx: CanvasRenderingContext2D, ball: Ball) {
  ctx.save();
  const speedFactor = ball.speedScaleFactor ?? 1.0;
  const blurLength = Math.min(5, Math.floor(speedFactor * 3));
  const { x: vx, y: vy } = ball.velocity;
  const speed = Math.sqrt(vx * vx + vy * vy);

  if (speed === 0) { // Evita divisão por zero
     ctx.restore();
     return;
  }

  const normalizedVx = vx / speed;
  const normalizedVy = vy / speed;

  ctx.fillStyle = ctx.fillStyle; // Usa a cor já definida para a bola (pode ser gradiente)

  for (let i = 1; i <= blurLength; i++) {
    ctx.globalAlpha = 0.3 * (1 - i / blurLength); // Desvanece o rastro
    ctx.beginPath();
    ctx.arc(
      ball.position.x - normalizedVx * i * 2, // Posição do rastro
      ball.position.y - normalizedVy * i * 2,
      ball.radius * (1 - i * 0.1), // Rastro diminui um pouco
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.restore();
}

function drawBallCurveEffect(ctx: CanvasRenderingContext2D, ball: Ball) {
  ctx.save();
  const { x, y } = ball.position;
  const { radius } = ball;
  const curveIntensity = ball.curveIntensity ?? 0;
  const curveDirection = ball.curveDirection ?? 1;

  // Only draw curve effect if there's actual curve
  if (Math.abs(curveIntensity) < 0.1) {
    ctx.restore();
    return;
  }

  // Draw curve indicator
  const startAngle = curveDirection > 0 ? 0 : Math.PI;
  const endAngle = curveDirection > 0 ? Math.PI : Math.PI * 2;

  // Draw curved path
  ctx.beginPath();
  ctx.strokeStyle = BALL_CURVE_COLOR;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;

  // Create curved path
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.5, startAngle, endAngle, curveDirection < 0);
  ctx.stroke();

  // Add arrow to indicate direction
  const arrowSize = radius * 0.5;
  const arrowAngle = curveDirection > 0 ? endAngle - Math.PI / 6 : startAngle + Math.PI / 6;
  const arrowX = x + Math.cos(arrowAngle) * radius * 1.5;
  const arrowY = y + Math.sin(arrowAngle) * radius * 1.5;

  ctx.beginPath();
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(
    arrowX + Math.cos(arrowAngle + Math.PI / 4) * arrowSize,
    arrowY + Math.sin(arrowAngle + Math.PI / 4) * arrowSize
  );
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(
    arrowX + Math.cos(arrowAngle - Math.PI / 4) * arrowSize,
    arrowY + Math.sin(arrowAngle - Math.PI / 4) * arrowSize
  );
  ctx.stroke();

  // Add glow effect
  ctx.shadowColor = BALL_CURVE_COLOR;
  ctx.shadowBlur = 10;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(x, y, radius * 1.2, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawTurboModeEffect(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  ctx.save();
  const canvasWidth = canvas.width;
  const canvasHeight = canvas.height;

  // Brilho sutil na borda
  const gradient = ctx.createLinearGradient(0, 0, canvasWidth, canvasHeight);
  gradient.addColorStop(0, TURBO_EFFECT_COLOR_1);
  gradient.addColorStop(0.5, TURBO_EFFECT_COLOR_2);
  gradient.addColorStop(1, TURBO_EFFECT_COLOR_1);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, canvasWidth - 8, canvasHeight - 8); // Desenha dentro da borda

  // Texto "TURBO MODE"
  ctx.font = 'bold 14px sans-serif';
  ctx.fillStyle = TURBO_TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.fillText("TURBO MODE", canvasWidth / 2, 20);

  // Linhas de movimento (efeito paralaxe simples)
  const lineCount = 10;
  ctx.strokeStyle = TURBO_EFFECT_COLOR_2; // Cor das linhas
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 15]); // Linhas tracejadas
  const timeFactor = (Date.now() / 50); // Fator de tempo para animação

  for (let i = 1; i <= lineCount; i++) {
    const y = i * (canvasHeight / (lineCount + 1));
    const offset = timeFactor % 40; // Animação de deslocamento horizontal

    ctx.beginPath();
    // Desenha segmentos de linha tracejada horizontalmente
    for (let x = -40 + offset; x < canvasWidth; x += 40) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 20, y); // Comprimento do traço
    }
    ctx.stroke();
  }
  ctx.restore(); // Restaura lineWidth, setLineDash, etc.
}

// --- Desenho de Overlays de Status ---
function drawGameStatusOverlays(ctx: CanvasRenderingContext2D, state: GameState, canvas: HTMLCanvasElement) {
  switch (state.status) {
    case GameStatus.WAITING_FOR_OPPONENT:
      const connectionStatus = webRTCService.getConnectionStatus();
      let message = 'Aguardando oponente...';
      
      if (connectionStatus === ConnectionStatus.CONNECTING) {
        message = 'Conectando...';
      } else if (connectionStatus === ConnectionStatus.DISCONNECTED) {
        message = 'Desconectado';
      } else if (connectionStatus === ConnectionStatus.ERROR) {
        message = 'Erro de conexão';
      }
      
      drawOverlayMessage(ctx, canvas, message);
      break;
    case GameStatus.COUNTDOWN:
      drawCountdownOverlay(ctx, canvas, state.countdown ?? 3);
      break;
    case GameStatus.PAUSED:
      drawOverlayMessage(ctx, canvas, 'Pausado');
      break;
    case GameStatus.GAME_OVER:
      drawGameOverOverlay(ctx, canvas, state.winner);
      break;
  }
}

function drawOverlayMessage(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, message: string) {
  ctx.save();
  ctx.fillStyle = OVERLAY_BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = '20px sans-serif';
  ctx.fillStyle = OVERLAY_TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle'; // Alinha verticalmente ao centro
  ctx.fillText(message, canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

function drawCountdownOverlay(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, countdown: number) {
  ctx.save();
  // Não desenha background para ver o jogo atrás
  ctx.font = '64px sans-serif';
  ctx.fillStyle = OVERLAY_TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Adiciona uma sombra para melhor legibilidade
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 5;
  ctx.fillText(countdown.toString(), canvas.width / 2, canvas.height / 2);
  ctx.restore();
}

function drawGameOverOverlay(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, winner: typeof PLAYER_ID | typeof OPPONENT_ID | null | undefined) {
  ctx.save();
  ctx.fillStyle = OVERLAY_BG_COLOR;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.font = '24px sans-serif';
  ctx.fillStyle = OVERLAY_TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillText('Fim de Jogo', canvas.width / 2, canvas.height / 2 - 30); // Ajusta posição

  if (winner) {
    const winnerText = winner === PLAYER_ID ? 'Você Venceu!' : 'Oponente Venceu';
    ctx.font = '20px sans-serif'; // Fonte menor para o resultado
    ctx.fillText(winnerText, canvas.width / 2, canvas.height / 2 + 10); // Ajusta posição
  }
  ctx.restore();
}

// --- Funções de Debug ---

function drawDebugInfo(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.save();
  const debugBoxX = 10;
  const debugBoxY = 10;
  const lineHeight = 18;
  let currentY = debugBoxY + lineHeight; // Posição Y inicial do texto

  // Informações a serem exibidas
  const debugLines = [
    `Status: ${state.status}`,
    `Player: ${gameManager.getPlayerRole()}`, // Assumindo que getPlayerRole existe
    `Rede: ${webRTCService.getConnectionStatus()}`, // Assumindo que getConnectionStatus existe
  ];

  if (state.status === GameStatus.COUNTDOWN) {
    debugLines.push(`Contagem: ${state.countdown ?? 'N/A'}`);
  }
  // Adicione mais linhas conforme necessário
  // debugLines.push(`Bola Pos: (${state.ball.position.x.toFixed(1)}, ${state.ball.position.y.toFixed(1)})`);

  const boxHeight = lineHeight * (debugLines.length + 1); // Calcula altura da caixa
  const boxWidth = 250; // Largura fixa

  // Fundo da caixa de debug
  ctx.fillStyle = DEBUG_BG_COLOR;
  ctx.fillRect(debugBoxX, debugBoxY, boxWidth, boxHeight);

  // Configurações do texto
  ctx.font = '12px monospace';
  ctx.fillStyle = DEBUG_TEXT_COLOR;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top'; // Alinha texto ao topo para facilitar cálculo da posição Y

  // Desenha cada linha de informação
  for (const line of debugLines) {
     ctx.fillText(line, debugBoxX + 10, currentY); // Adiciona padding interno
     currentY += lineHeight; // Move para a próxima linha
  }

  ctx.restore();
}

// --- Tratamento de Redimensionamento ---
function handleResize() {
  const container = containerRef.value;
  const canvas = canvasRef.value;

  if (!container || !canvas) {
    console.warn('Container or canvas not ready for resize.');
    return;
  }

  try {
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // Mantém a proporção lógica definida nas props
    const aspectRatio = props.width / props.height;

    let displayWidth = containerWidth;
    let displayHeight = containerWidth / aspectRatio;

    // Se a altura calculada exceder a altura do container, baseia o cálculo na altura
    if (displayHeight > containerHeight) {
      displayHeight = containerHeight;
      displayWidth = containerHeight * aspectRatio;
    }

    // Define o tamanho de exibição do canvas (CSS pixels)
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    // Define o tamanho real do buffer de desenho do canvas (resolução interna)
    canvas.width = props.width;
    canvas.height = props.height;

    // Renderiza imediatamente após o redimensionamento
    render();
  } catch (error) {
    console.error('Error during resize:', error);
  }
}

// --- Ciclo de Vida e Observadores ---
onMounted(() => {
  // Check for WebRTC support
  if (!navigator.mediaDevices && !window.RTCPeerConnection) {
    console.warn('WebRTC is not fully supported in this browser. Some features may not work.');
  }

  // Check for Canvas support
  if (!canvasRef.value?.getContext('2d')) {
    console.error('Canvas 2D context is not supported in this browser.');
    return;
  }

  // Define a função de renderização que o gameManager chamará
  try {
    gameManager.setRenderCallback(render);
  } catch (error) {
    console.error('Failed to set render callback:', error);
  }

  // Vincula eventos de teclado (ou outros controles)
  try {
    gameManager.bindKeyboardEvents();
  } catch (error) {
    console.error('Failed to bind keyboard events:', error);
  }

  // Habilita modo debug se ?debug estiver na URL
  const urlParams = new URLSearchParams(window.location.search);
  debugEnabled.value = urlParams.has('debug');
  if(debugEnabled.value) {
}

  // Adiciona listener para redimensionamento da janela
  try {
    window.addEventListener('resize', handleResize);
  } catch (error) {
    console.error('Failed to add resize listener:', error);
  }

  // Chama handleResize uma vez para configurar o tamanho inicial
  handleResize();
});

onUnmounted(() => {
  // Remove listener de redimensionamento para evitar memory leaks
  window.removeEventListener('resize', handleResize);

  // Desvincula eventos de teclado
  gameManager.unbindKeyboardEvents();

  // Limpa o callback de renderização no gameManager (boa prática)
  gameManager.setRenderCallback(() => {}); // Usando função vazia em vez de null

  // Para o loop do jogo (se aplicável)
  // Exemplo: gameManager.stopGameLoop();
});

// Observa mudanças nas props de largura/altura e redimensiona
watch([() => props.width, () => props.height], () => {
handleResize();
}, { immediate: false }); // Não precisa ser imediato pois onMounted já chama handleResize

</script>

<template>
  <div ref="containerRef" class="game-container">
    <canvas ref="canvasRef" class="game-canvas">
      Seu navegador não suporta o elemento Canvas. </canvas>
  </div>
</template>

<style scoped>
.game-container {
  width: 100%; /* Ocupa todo o espaço do pai */
  height: 100%;
  display: flex; /* Centraliza o canvas */
  justify-content: center;
  align-items: center;
  background-color: #0a0a0a; /* Cor de fundo ligeiramente diferente para contraste */
  overflow: hidden; /* Evita barras de rolagem se o canvas ficar ligeiramente maior */
}

.game-canvas {
  /* A cor de fundo do canvas é definida no JS, mas podemos definir uma aqui para o elemento em si */
  background-color: #121212;
  /* Adiciona uma sombra sutil para destacar o canvas */
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
  /* Garante que o canvas não exceda o container (redundante com JS, mas seguro) */
  max-width: 100%;
  max-height: 100%;
  /* 'object-fit: contain' não se aplica diretamente ao canvas, o JS controla o tamanho */
  display: block; /* Remove espaço extra abaixo do canvas (inline default) */
}

/* Estilos para telas menores (exemplo) */
@media (max-width: 768px) {
  .game-canvas {
    box-shadow: none; /* Remove sombra em telas pequenas */
  }
  /* Você pode adicionar outros ajustes aqui se necessário */
}
</style>