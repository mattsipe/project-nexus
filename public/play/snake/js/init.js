// Reserve room for the on-screen gamepad (visible on touch devices only) so
// the board ends above it instead of underneath it. When the gamepad is
// hidden (desktop), offsetHeight is 0 and no space is reserved.
const gamepad = document.getElementById("snake-gamepad");
const gamepadOffset =
  gamepad && gamepad.offsetHeight
    ? Math.round(window.innerHeight - gamepad.getBoundingClientRect().top)
    : 0;

// [Nexus] fullScreen sized the board to the window, which at 1366x768 gave a
// 67x35 grid of 20px blocks — a speck of a snake crossing an empty field, and
// nothing like the game people remember. Fixed at 30x22 cells instead, the
// proportions of the classic handheld version. 720 rather than a tighter box
// because snake.js hides the author's in-game credit links below 700px wide.
// Nexus's player scales the whole
// page up to the frame (player.nativeWidth in the manifest), so a larger screen
// gets a larger board rather than more empty squares.
const mySnakeBoard = new SNAKE.Board({
  boardContainer: "game-area",
  fullScreen: false,
  width: 720,
  height: 470,
  top: 0,
  left: 0,
  bottomOffset: gamepadOffset,
  premoveOnPause: false,
  onLengthUpdate: (length) => {
    console.log(`Length: ${length}`);
  },
  onPauseToggle: (isPaused) => {
    console.log(`Is paused: ${isPaused}`);
  },
  onInit: (params) => {
    console.log("init!");
    console.log(params);
  },
  onWin: () => {
    console.log("wn!");
  },
  onDeath: () => {
    console.log("dead!");
  },
});

// Wire up the on-screen gamepad shown on touch devices (markup in index.html).
document.querySelectorAll("#snake-gamepad button").forEach((btn) => {
  btn.addEventListener("pointerdown", (evt) => {
    evt.preventDefault();
    mySnakeBoard.simulateKeyPress(parseInt(btn.dataset.key, 10));
  });
});
