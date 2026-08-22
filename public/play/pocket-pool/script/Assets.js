"use strict";

var sprites = {};
var sounds = {};

Game.loadAssets = function () {
    var loadSprite = function (sprite) {
        return Game.loadSprite("assets/sprites/" + sprite);
    };

     var loadSound = function (sound) {
        return new Audio("assets/sounds/" + sound);
    };

    sprites.mainMenuBackground = loadSprite("main_menu_background.webp");
    sprites.background = loadSprite("spr_background4.webp");
    sprites.ball = loadSprite("spr_ball2.webp");
    sprites.redBall = loadSprite("spr_redBall2.webp");
    sprites.yellowBall = loadSprite("spr_yellowBall2.webp");
    sprites.blackBall = loadSprite("spr_blackBall2.webp");
    sprites.stick = loadSprite("spr_stick.webp");
    sprites.twoPlayersButton = loadSprite("2_players_button.webp");
    sprites.twoPlayersButtonHover = loadSprite("2_players_button_hover.webp");
    sprites.onePlayersButton = loadSprite("1_player_button.webp");
    sprites.onePlayersButtonHover = loadSprite("1_player_button_hover.webp");
    sprites.muteButton = loadSprite("mute_button.webp");
    sprites.muteButtonHover = loadSprite("mute_button_hover.webp");
    sprites.muteButtonPressed = loadSprite("mute_button_pressed.webp");
    sprites.muteButtonPressedHover = loadSprite("mute_button_pressed_hover.webp");
    sprites.easyButton = loadSprite("easy_button.webp");
    sprites.easyButtonHover = loadSprite("easy_button_hover.webp");
    sprites.mediumButton = loadSprite("medium_button.webp");
    sprites.mediumButtonHover = loadSprite("medium_button_hover.webp");
    sprites.hardButton = loadSprite("hard_button.webp");
    sprites.hardButtonHover = loadSprite("hard_button_hover.webp");
    sprites.backButton = loadSprite("back_button.webp");
    sprites.backButtonHover = loadSprite("back_button_hover.webp");
    sprites.continueButton = loadSprite("continue_button.webp");
    sprites.continueButtonHover = loadSprite("continue_button_hover.webp");
    sprites.insaneButton = loadSprite("insane_button.webp");
    sprites.insaneButtonHover = loadSprite("insane_button_hover.webp");
    sprites.aboutButton = loadSprite("about_button.webp");
    sprites.aboutButtonHover = loadSprite("about_button_hover.webp");
    sprites.controls = loadSprite("controls.webp");

    sounds.side = loadSound("Side.wav");
    sounds.ballsCollide = loadSound("BallsCollide.wav");
    sounds.strike = loadSound("Strike.wav");
    sounds.hole = loadSound("Hole.wav");
    
    // [Nexus] Upstream loaded "Bossa Antigua" by Kevin MacLeod here, under
    // CC-BY 3.0 — a third-party work the repo's own MIT licence does not
    // cover, shipped without the attribution that licence requires, and
    // played the moment the menu opened. Removed; Menu.js copes with the
    // absence. See NEXUS-MODIFICATIONS.txt.
    sounds.jazzTune = undefined;
}

sounds.fadeOut = function(sound) {

    // [Nexus] Callers pass Game.mainMenu.sound, which is now absent — see the
    // note above. Nothing to fade.
    if (!sound) return;

    var fadeAudio = setInterval(function () {

        if(GAME_STOPPED)
            return;

        // Only fade if past the fade out point or not at zero already
        if ((sound.volume >= 0.05)) {
            sound.volume -= 0.05;
        }
        else{
            sound.pause();
            clearInterval(fadeAudio);
        }
    }, 400);
}