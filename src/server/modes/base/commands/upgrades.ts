import { MOB_TYPES } from '@airbattle/protocol';
import { UPGRADES_ACTION_TYPE } from '@/constants';
import {
  COMMAND_DROP_UPGRADE,
  ERRORS_NOT_ENOUGH_UPGRADES,
  RESPONSE_COMMAND_REPLY,
  RESPONSE_PLAYER_UPGRADE,
  POWERUPS_SPAWN,
  BROADCAST_PLAYER_UPDATE,
  RESPONSE_SCORE_UPDATE,
} from '@/events';
import { System } from '@/server/system';
import { MainConnectionId } from '@/types';

export default class UpgradesCommandHandler extends System {
  constructor({ app }) {
    super({ app });

    this.listeners = {
      [COMMAND_DROP_UPGRADE]: this.onCommandReceived,
    };
  }

  onCommandReceived(connectionId: MainConnectionId, command = ''): void {
    const connection = this.storage.connectionList.get(connectionId);
    const player = this.storage.playerList.get(connection.meta.playerId);

    if (command.startsWith('drop')) {
      let amount = 1;

      if (command.length > 5) {
        if (command[4] !== ' ') {
          return;
        }

        amount = ~~command.substring(5);
      }

      if (amount <= 0) {
        return;
      }

      if (amount > 5) {
        this.emit(RESPONSE_COMMAND_REPLY, connectionId, 'Max 5 upgrades.');

        return;
      }

      if (player.upgrades.amount >= amount) {
        player.upgrades.amount -= amount;

        this.emit(RESPONSE_PLAYER_UPGRADE, connection.meta.playerId, UPGRADES_ACTION_TYPE.LOST);
        this.log.debug(`Player id${connection.meta.playerId} dropped ${amount} upgrades.`);

        while (amount !== 0) {
          amount -= 1;

          this.emit(POWERUPS_SPAWN, {
            mobId: this.helpers.createMobId(),
            type: MOB_TYPES.UPGRADE,
            posX: ~~player.position.x,
            posY: ~~player.position.y,
            ownerId: player.id.current,
          });
        }
      } else {
        this.emit(ERRORS_NOT_ENOUGH_UPGRADES, connectionId);
      }
    } else if (command.startsWith('reset')) {
      /**
       * The command is not parsed intentionally.
       */
      if (command === 'reset') {
        player.upgrades.speed = 0;
        player.upgrades.defense = 0;
        player.upgrades.energy = 0;
        player.upgrades.missile = 0;
      } else if (command === 'reset speed') {
        player.upgrades.speed = 0;
        player.delayed.BROADCAST_PLAYER_UPDATE = true;
      } else if (command === 'reset defense') {
        player.upgrades.defense = 0;
      } else if (command === 'reset energy') {
        player.upgrades.energy = 0;
      } else if (command === 'reset missile') {
        player.upgrades.missile = 0;
      }

      this.emit(RESPONSE_PLAYER_UPGRADE, connection.meta.playerId, UPGRADES_ACTION_TYPE.LOST);
      this.log.debug(`Player id${connection.meta.playerId} reset upgrades.`);

      if (player.delayed.BROADCAST_PLAYER_UPDATE) {
        this.emit(BROADCAST_PLAYER_UPDATE, connection.meta.playerId);
      }
    } else if (player.su.current === true && command.startsWith('give')) {
      let amount = 1;

      if (command.length > 5) {
        amount = ~~command.substring(5);
      }

      if (amount <= 0) {
        return;
      }

      player.upgrades.amount += amount;

      this.emit(RESPONSE_SCORE_UPDATE, player.id.current);
      this.log.debug(`Player id${connection.meta.playerId} give ${amount} upgrades to himself.`);
    }
  }
}