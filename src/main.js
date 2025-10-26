import * as Phaser from "phaser";
import MenuScene from "./scenes/MenuScene.js";
import VillageScene from "./scenes/VillageScene.js";
import VillageLobbyScene from "./scenes/VillageLobbyScene.js";
import AvatarCustomizationScene from "./scenes/AvatarCustomizationScene.js";
import HouseCustomizationScene from "./scenes/HouseCustomizationScene.js";
import { initialize } from './firebase-config.js';
import InteriorScene from "./scenes/InteriorScene.js";

initialize.then(() => {
    console.log("Firebase initialized, creating game...");
    const config = {
      type: Phaser.AUTO,
      pixelArt: true,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: 'game',
      dom: {
        createContainer: true
      },
      backgroundColor: "#333333",
      scene: [MenuScene, VillageLobbyScene, AvatarCustomizationScene, HouseCustomizationScene, VillageScene, InteriorScene],
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
      },
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: 500 }, // Add vertical gravity
          debug: true // Set to true for debugging
        }
      }
    };

    const game = new Phaser.Game(config);
    window.game = game; // Optional for debugging
});
