

const v86BaseKillEnemy=
  killEnemy;

killEnemy=function(
  enemy,
  owner
){

  const enemyId=
    enemy?.id;

  const wasAlive=
    Boolean(
      enemy &&
      !enemy.dead
    );

  const result=
    v86BaseKillEnemy(
      enemy,
      owner
    );

  if(
    wasAlive &&
    enemy?.dead &&
    enemyId &&
    multiplayer.active &&
    multiplayer.isHost
  ){
    multiplayer.pendingRemovedEnemyIds.add(
      enemyId
    );
  }

  return result;

};

