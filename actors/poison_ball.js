import Phaser from "phaser";
import {
    CAPTAIN_ATTACK_DAMAGE,
    CAPTAIN_PROJECTILE_SPEED,
    PIXEL_SCALE,
} from "../variables";

export class PoisonBall extends Phaser.GameObjects.Sprite {
    /** @param {Phaser.Scene} scene */
    constructor(scene) {
        super(scene, 0, 0, "poison-ball");

        scene.physics.add.existing(this);
        this.setScale(PIXEL_SCALE);

        this.setDataEnabled(true);
        this.data.set("actor", this);


        // adjust hitbox
        this.body.setSize(16, 16);
        this.depth = 10000;

        this.damage = CAPTAIN_ATTACK_DAMAGE;
    }

    fire(x, y, direction) {

        this.scene.physics.add.overlap(
            this,
            [
                this.scene.player.player,
                ...this.scene.pinkies.map((pinky) => pinky.pinky),
                ...this.scene.captains.filter((captain) => captain != this.originator).map((captain) => captain.captain),
            ],
            (projectile, player, colInfo) => {
                if (this.active) {
                    let poisonActor = projectile.data.get("actor");
                    let actor = player.data.get("actor");
                    actor.takeDamage(poisonActor.damage);
                    this.spawnExplosion();
                    this.die();
                }
            },
            // collide only if the player is vulnerable
            () => this.scene.player.vulnerable
        );

        let vel = direction.normalize().scale(CAPTAIN_PROJECTILE_SPEED);
        this.body.setVelocity(vel.x, vel.y);
        this.play("poison-ball");
        this.setPosition(x, y - 50);

        this.setActive(true);
        this.setVisible(true);

        this.scene.time.addEvent({
            delay: 10000,
            callback: this.die,
            callbackScope: this,
        });
    }

    spawnExplosion() {
        let explosion = this.scene.add.sprite(this.x, this.y);
        explosion.setScale(PIXEL_SCALE);
        // put explosion on top of everything (probably)
        explosion.setDepth(5000);
        explosion.play("poison-ball-explosion");
        explosion.on(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
            explosion.destroy();
        });
    }

    die() {
        this.destroy();
    }
}
