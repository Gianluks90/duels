import { Injectable, inject } from '@angular/core';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  collection,
  where,
  getDocs,
} from 'firebase/firestore';
import { FirebaseService } from './firebase.service';
import type { UserProfile } from '../models/user.model';

export interface FriendRequest {
  id: string;
  fromUid: string;
  toUid: string;
  /** Denormalizzato al momento della richiesta (stesso pattern di GameDoc.hostName/hostPhoto in
   * game.service.ts) — il destinatario non può ancora leggere il profilo del mittente (non sono amici
   * finché non accetta), quindi senza questo non saprebbe chi lo sta contattando. */
  fromName: string;
  fromPhoto: string | null;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number;
}

/**
 * Amicizie (Qualità della vita) — nessun campo "friendIds" sul profilo utente: l'unica fonte di
 * verità per "siamo amici" è l'esistenza di un documento in questa collezione con status=='accepted',
 * verificata dalle regole Firestore (isFriend, firestore.rules) prima di autorizzare la lettura del
 * profilo altrui. Un array scrivibile dal proprietario stesso (es. UserProfile.friendIds) sarebbe
 * stato manomettibile — chiunque avrebbe potuto scriversi da solo l'accesso al profilo di un altro
 * senza che quello avesse mai accettato nulla.
 *
 * requestId deterministico "{fromUid}_{toUid}": dedup naturale (una sola richiesta pendente per
 * coppia/direzione) e permette a isAcceptedFriendRequest (firestore.rules) di verificare l'esistenza
 * con un get() diretto sull'ID invece di una query.
 */
@Injectable({ providedIn: 'root' })
export class FriendsService {
  private readonly db = inject(FirebaseService).db;

  /** Manda una richiesta di amicizia — se l'altro me ne aveva già mandata una (stesso ragionamento in
   * direzione opposta), la accetta direttamente invece di crearne una seconda: amicizia reciproca
   * immediata, nessuna richiesta pendente residua su nessuno dei due lati. */
  async sendRequest(myProfile: UserProfile, toUid: string): Promise<void> {
    if (toUid === myProfile.uid) throw new Error('cannot-friend-self');

    const reverseRef = doc(this.db, 'friendRequests', this.requestId(toUid, myProfile.uid));
    const reverseSnap = await getDoc(reverseRef);
    if (reverseSnap.exists() && (reverseSnap.data() as FriendRequest).status === 'pending') {
      await updateDoc(reverseRef, { status: 'accepted' });
      return;
    }

    const ref = doc(this.db, 'friendRequests', this.requestId(myProfile.uid, toUid));
    const data: FriendRequest = {
      id: ref.id,
      fromUid: myProfile.uid,
      toUid,
      fromName: myProfile.displayName,
      fromPhoto: myProfile.photoURL,
      status: 'pending',
      createdAt: Date.now(),
    };
    await setDoc(ref, data);
  }

  async respondToRequest(requestId: string, accept: boolean): Promise<void> {
    await updateDoc(doc(this.db, 'friendRequests', requestId), {
      status: accept ? 'accepted' : 'declined',
    });
  }

  /** Solo il mittente originale può rimandare, e solo dopo un rifiuto — vedi firestore.rules. */
  async resendRequest(requestId: string): Promise<void> {
    await updateDoc(doc(this.db, 'friendRequests', requestId), { status: 'pending' });
  }

  /** Cancella la richiesta/amicizia — un solo documento condiviso tra le due parti, quindi annulla o
   * disamicizia entrambi insieme, non solo il mio lato. */
  async unfriend(requestId: string): Promise<void> {
    await deleteDoc(doc(this.db, 'friendRequests', requestId));
  }

  listIncoming(myUid: string): Promise<FriendRequest[]> {
    return this.queryRequests('toUid', myUid, 'pending');
  }

  /** Anche le rifiutate (non solo le pending): la UI le mostra con un'opzione "rimanda". */
  listOutgoing(myUid: string): Promise<FriendRequest[]> {
    return this.queryRequests('fromUid', myUid, ['pending', 'declined']);
  }

  /** Amici accettati — la relazione può avermi come fromUid O toUid a seconda di chi ha inviato la
   * richiesta originale (vedi otherUid sotto), quindi due query separate, unite. */
  async listFriends(myUid: string): Promise<FriendRequest[]> {
    const [asFrom, asTo] = await Promise.all([
      this.queryRequests('fromUid', myUid, 'accepted'),
      this.queryRequests('toUid', myUid, 'accepted'),
    ]);
    return [...asFrom, ...asTo];
  }

  /** L'uid dell'ALTRA persona in una FriendRequest, dato il mio — serve perché non so a priori se ero
   * fromUid o toUid nella richiesta originale (vedi listFriends). */
  otherUid(request: FriendRequest, myUid: string): string {
    return request.fromUid === myUid ? request.toUid : request.fromUid;
  }

  /** Profilo di un amico — get() diretto, autorizzato dalle regole solo se esiste una FriendRequest
   * accepted tra noi due (firestore.rules, isFriend). Nessun controllo qui: se non siamo amici la
   * lettura fallisce già a livello di regole. */
  async getFriendProfile(uid: string): Promise<UserProfile | null> {
    const snapshot = await getDoc(doc(this.db, 'users', uid));
    return snapshot.exists() ? (snapshot.data() as UserProfile) : null;
  }

  private requestId(fromUid: string, toUid: string): string {
    return `${fromUid}_${toUid}`;
  }

  private async queryRequests(
    field: 'fromUid' | 'toUid',
    uid: string,
    status: FriendRequest['status'] | FriendRequest['status'][],
  ): Promise<FriendRequest[]> {
    const q = query(
      collection(this.db, 'friendRequests'),
      where(field, '==', uid),
      Array.isArray(status) ? where('status', 'in', status) : where('status', '==', status),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as FriendRequest);
  }
}
