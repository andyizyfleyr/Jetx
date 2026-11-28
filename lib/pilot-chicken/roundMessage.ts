type Round = {phase:'betting'|'decision';step:number;chosen:boolean;joined:boolean};
export function chickenInstruction(ready:boolean,legacy:boolean,phase:'idle'|'playing'|'won'|'lost',round?:Round,message?:string):{title:string;detail:string} {
 if(!ready)return {title:'Connexion au jeu…',detail:message||'Les actions seront disponibles après synchronisation.'};
 if(message)return {title:'Information',detail:message};
 if(legacy)return {title:'Votre ancienne partie',detail:'Terminez-la avant de rejoindre une manche commune.'};
 if(!round)return {title:'Synchronisation…',detail:'Chargement de la prochaine manche.'};
 if(round.phase==='betting')return round.joined
  ? {title:'Mise enregistrée',detail:'Attendez le départ, puis choisissez de traverser ou d’encaisser.'}
  : {title:'Mises ouvertes',detail:'Choisissez votre mise puis appuyez sur Miser avant la fin du compte à rebours.'};
 if(!round.joined)return {title:'Manche en cours',detail:'Les mises sont fermées. Vous pourrez jouer à la prochaine manche.'};
 if(phase!=='playing')return {title:'Votre partie est terminée',detail:'Attendez la fin de la manche pour miser à nouveau.'};
 if(round.chosen)return {title:'Traversée confirmée',detail:'Attendez la fin du compte à rebours pour découvrir l’obstacle.'};
 return {title:`Traversée ${round.step} : à vous de choisir`,detail:'Traversez ou encaissez. Sans réponse, votre gain atteint sera encaissé.'};
}
