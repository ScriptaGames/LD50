import Phaser from "phaser";
import { Actor } from "./actor";
import {
  PLAYER_SPEED,
  DODGE_SPEED_BONUS,
  DODGE_COOLDOWN,
  DODGE_DURATION,
  WEAPON_HOVER_DISTANCE,
  DODGE_GRACE_PERIOD,
  PIXEL_SCALE,
  ATTACK_GRACE_PERIOD,
  PLAYER_BASE_HP,
  PLAYER_BASE_DAMAGE,
} from "../variables";

export class Player extends Actor {
  /** @param {Phaser.Scene} scene */
  constructor(scene) {
    super(scene, { hp: PLAYER_BASE_HP, damage: PLAYER_BASE_DAMAGE });
  }
  /** @param {Phaser.Scene} scene */
  static preload(scene) {
    scene.load.spritesheet("dwarf-idle", "images/dwarfBody_idle_strip.png", {
      frameWidth: 36,
      frameHeight: 36,
    });

    scene.load.spritesheet("dwarf-run", "images/dwarfBody_run_strip.png", {
      frameWidth: 36,
      frameHeight: 36,
    });

    scene.load.spritesheet("dwarf-dodge", "images/dwarfBody_dodge_strip.png", {
      frameWidth: 36,
      frameHeight: 36,
    });

    scene.load.spritesheet(
      "dwarf-attack",
      "images/dwarfBody_attack_strip.png",
      { frameWidth: 36, frameHeight: 36 }
    );

    scene.load.spritesheet("axe-attack", "images/dwarfAxe_attack_strip.png", {
      frameWidth: 36,
      frameHeight: 36,
    });

    scene.load.spritesheet(
      "right-hand",
      "images/dwarfFrontHand_run_strip.png",
      { frameWidth: 36, frameHeight: 36 }
    );

    scene.load.spritesheet("left-hand", "images/dwarfBackHand_run_strip.png", {
      frameWidth: 36,
      frameHeight: 36,
    });
  }
  create() {
    super.create();
    this.player = this.mainSprite = this.scene.add.sprite(250, 500);
    this.player.setScale(PIXEL_SCALE);
    this.player.play("dwarf-idle");
    this.player.setOrigin(0.5);
    this.scene.physics.add.existing(this.player);
    this.player.setDataEnabled();
    this.player.data.set("actor", this);

    // save a reference to the player body with the correct type
    /** @type {Phaser.Physics.Arcade.Body} */
    this.playerBody = this.player.body;

    // adjust hitbox
    this.playerBody.setSize(15, 28);
    this.playerBody.setOffset(10, 4);

    this.speedBoost = new Phaser.Math.Vector2();

    // this.hands = this.scene.add.circle(0, 0, 20, 0x919191, 1);

    this.leftHand = this.scene.add.sprite(64, 64, "left-hand");
    this.leftHand.setScale(PIXEL_SCALE);
    // this.leftHand.play("left-hand");
    this.rightHand = this.scene.add.sprite(128, 128, "right-hand");
    this.rightHand.setScale(PIXEL_SCALE);

    // this.scene.physics.add.existing(this.hands);

    this.axe = this.scene.add.sprite(100, 100, "axe-attack");
    this.axe.setScale(PIXEL_SCALE);
    this.axe.visible = false;
    this.scene.physics.add.existing(this.axe);

    this.createKeyboardControls();
    this.createMouse();

    // set a pretty-good not-too-bad fairly accurate hitbox
    /** @type {Phaser.Physics.Arcade.Body} */
    this.axeBody = this.axe.body;
    this.axeBody.immovable = true;
    // adjust axe hitbox to fit the sprite better
    this.axeBody.setSize(27, 27);
    this.axeLive(false);
  }

  update() {
    // set z-index depth
    this.player.depth = this.player.y + this.player.height;
    this.leftHand.depth = this.player.depth - 0.1;
    this.rightHand.depth = this.player.depth + 0.1;

    this.handleKeyboard();
    this.updateHandPosition();
  }

  /**
   * Create animations to be used by any Player instances.
   * @param {Phaser.Scene} scene
   */
  static createAnims(scene) {
    // loop through each spritesheet and create an animation
    [
      "dwarf-idle",
      "dwarf-run",
      "dwarf-dodge",
      "left-hand",
      "right-hand",
      "dwarf-attack",
    ].forEach((name) => {
      scene.anims.create({
        key: name,
        frames: scene.anims.generateFrameNumbers(name),
        frameRate: 10,
        repeat: -1,
      });
    });
    scene.anims.create({
      key: "axe-attack",
      frames: scene.anims.generateFrameNumbers("axe-attack"),
      frameRate: 15,
      repeat: 0,
    });
  }

  createMouse() {
    this.scene.input.mouse.disableContextMenu(); // disable right click menu

    this.mouse = new Phaser.Math.Vector2(0, 0);
    this.scene.input.on("pointermove", (pointer) => {
      this.mouse.copy(pointer);
    });

    this.scene.input.on("pointerdown", () => {
      this.trySwingAxe();
    });
  }

  createKeyboardControls() {
    /** Various state about dodging. */
    this.dodge = {
      x: 0,
      y: 0,
      ready: true,
      keyReleased: true,
      dodging: false,
      gracePeriod: true,
    };
    /** Various state about dwarf's attacks. */
    this.attack = {
      /** True when the attack animation is playing. */
      attacking: false,
      /** True when not attacking, and true near the end of the attack animation, when the animation is still playing, but it's possible to move and dodge again. */
      gracePeriod: true,
      /** True when the axe is in one of it's "damage frames", ie the frames in the spritesheet where there's a BIG SWOOSH. */
      activeFrame: false,
    };
    this.kb = this.scene.input.keyboard.addKeys("W,A,S,D,SPACE");
  }

  handleKeyboard() {
    this.playerBody.setVelocity(0, 0);

    // choose whether to play/continue idle, run, or dodge anim
    let isRunning =
      this.kb.W.isDown ||
      this.kb.A.isDown ||
      this.kb.S.isDown ||
      this.kb.D.isDown;
    if (this.dodge.dodging && this.attack.gracePeriod) {
      // since we're dodging, flip the sprite in the direction of the dodge
      this.player.setFlipX(this.dodge.x < 0);
      // play dodge anim if not already playing it
      if (this.player.anims.getName() !== "dwarf-dodge") {
        this.player.play("dwarf-dodge");
      }
    } else if (!this.attack.attacking) {
      if (isRunning) {
        // play run anim if not already playing it
        if (this.player.anims.getName() !== "dwarf-run") {
          this.player.play("dwarf-run");
          this.leftHand.play({
            key: "left-hand",
          });
          this.rightHand.play({
            key: "right-hand",
          });
        }
      } else {
        // play idle anim if not already playing it
        if (this.player.anims.getName() !== "dwarf-idle") {
          this.player.play("dwarf-idle");
        }
        this.leftHand.stop();
        this.rightHand.stop();
      }
    }

    // apply WASD motion if dodge status allows it

    if (this.dodge.gracePeriod && this.attack.gracePeriod) {
      // apply left/right motion
      if (this.kb.A.isDown) {
        this.playerBody.setVelocityX(-1);
        this.dodge.x = -1;
        this.player.setFlipX(true);
      } else if (this.kb.D.isDown) {
        this.playerBody.setVelocityX(1);
        this.dodge.x = 1;
        this.player.setFlipX(false);
      }

      // apply up/down motion
      if (this.kb.W.isDown) {
        this.playerBody.setVelocityY(-1);
        this.dodge.y = -1;
      } else if (this.kb.S.isDown) {
        this.playerBody.setVelocityY(1);
        this.dodge.y = 1;
      }

      // ensure the next dodge is pointing in the right direction
      const goingHoriz = this.kb.A.isDown || this.kb.D.isDown;
      const goingVert = this.kb.W.isDown || this.kb.S.isDown;
      if (goingHoriz && !goingVert) {
        this.dodge.y = 0;
      }
      if (goingVert && !goingHoriz) {
        this.dodge.x = 0;
      }
    }

    // if space is pressed, and dodge is off cooldown, and the key has been
    // released since the last dodge, then dodge!
    if (
      this.kb.SPACE.isDown &&
      this.dodge.ready &&
      this.dodge.keyReleased &&
      this.attack.gracePeriod
    ) {
      // start dodging
      this.dodge.dodging = true;
      this.dodge.ready = false;
      this.dodge.keyReleased = false;
      this.dodge.gracePeriod = false;

      // become invul during the dodge roll
      this.setVulnerable(false);

      // apply speed boost in the direction of the dodge
      this.speedBoost.copy(this.dodge).normalize().scale(DODGE_SPEED_BONUS);

      this.playerBody.setVelocity(this.dodge.x, this.dodge.y);

      // start cooldown timer
      this.scene.time.delayedCall(
        DODGE_COOLDOWN,
        () => (this.dodge.ready = true)
      );

      // start dodge duration timer
      this.scene.time.delayedCall(
        DODGE_DURATION,
        () => (this.dodge.dodging = false)
      );

      // start timer until player can move with WASD again
      this.scene.time.delayedCall(DODGE_GRACE_PERIOD, () => {
        this.dodge.gracePeriod = true;

        // become vulnerable again during the grace period
        this.setVulnerable(true);
      });

      // tween the speedBoost back to 0
      this.scene.tweens.add({
        targets: this.speedBoost,
        x: 0, // the property to tween
        y: 0, // the property to tween
        delay: 0,
        duration: DODGE_DURATION, // ms
        ease: Phaser.Math.Easing.Quartic.Out, // https://easings.net/ and https://photonstorm.github.io/phaser3-docs/Phaser.Math.Easing.html
      });
    }
    // detect dodge key release
    if (this.kb.SPACE.isUp) {
      this.dodge.keyReleased = true;
    }

    this.playerBody.velocity
      .normalize()
      .scale(PLAYER_SPEED)
      .add(this.speedBoost);
  }

  updateHandPosition() {
    this.leftHand.copyPosition(this.player);
    this.leftHand.setFlipX(this.player.flipX);

    this.rightHand.copyPosition(this.player);
    this.rightHand.setFlipX(this.player.flipX);

    // also update the weapon hitbox position
    if (!this.attack.attacking) {
      this.axe.copyPosition(this.player);
    }
  }

  /** Attack, if we're in a state that allows attacking. */
  trySwingAxe() {
    // yes, this looks wrong, but just, I mean... just trust me.
    this.axeLive(false);

    if (this.dodge.gracePeriod && this.attack.gracePeriod) {
      this.attack.attacking = true;
      this.attack.gracePeriod = false;

      this.player.setFlipX(this.mouse.x - this.player.x < 0);

      // also set the horizontal dodge direction to match the direction the player is facing
      this.dodge.x = this.player.flipX ? -1 : 1;

      this.leftHand.setVisible(false);
      this.rightHand.setVisible(false);
      this.axe.setFlipX(this.player.flipX);

      const axeOffset = new Phaser.Math.Vector2()
        .copy(this.mouse)
        .subtract(this.player)
        .normalize()
        .scale(WEAPON_HOVER_DISTANCE);

      const axePos = axeOffset.clone().add(this.player);

      // rotate towards the cursor
      this.axe.setRotation(axeOffset.angle() * 2);
      // apply special compensation to make downward attacks look better (FRAGILE, hope to replace)
      if (axeOffset.y > 0) {
        if (axeOffset.x > 0) {
          this.axe.rotation -= axeOffset.y / 36;
        } else {
          this.axe.rotation += axeOffset.y / 36;
        }
      }

      this.axeBody.position.copy(axePos);

      this.axe.copyPosition(this.axeBody.position);

      // play attack anims
      this.axe.play({
        key: "axe-attack",
        hideOnComplete: true,
        showOnStart: true,
      });
      this.player.play("dwarf-attack");

      this.scene.time.delayedCall(
        ATTACK_GRACE_PERIOD,
        () => (this.attack.gracePeriod = true)
      );

      this.axe.on(
        Phaser.Animations.Events.ANIMATION_UPDATE,
        /** @param {number} frameIndex */
        // not sure what the first three args are
        (foo, bar, baz, frameIndex) => {
          // enable hitbox on the big SWOOSH frames
          this.axeLive(frameIndex == 2 || frameIndex == 7);
        }
      );

      this.axe.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
        this.attack.attacking = false;
        this.leftHand.setVisible(true);
        this.rightHand.setVisible(true);
      });
    }
  }

  /**
   * Enable or disable the axe's damage.  This is to help align the axe's
   * damage with the spritesheet's "big swoosh" frames.
   * @param {number} enabled
   */
  axeLive(enabled) {
    if (enabled) {
      this.attack.activeFrame = true;
    } else {
      this.attack.activeFrame = false;
    }
  }
}
