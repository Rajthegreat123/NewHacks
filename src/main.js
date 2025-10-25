import * as Phaser from "phaser";
import MenuScene from "./scenes/MenuScene.js";
import VillageScene from "./scenes/VillageScene.js";
import { initialize } from './firebase-config.js';

initialize.then(() => {
    console.log("Firebase initialized, creating game...");
    const config = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: 'game',
      backgroundColor: "#333333",
      scene: [MenuScene, VillageScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: 0, x: 0 }
        }
      }
    };

    const game = new Phaser.Game(config);
    window.game = game; // Optional for debugging
});
