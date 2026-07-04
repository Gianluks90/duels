import { Injectable } from '@angular/core';
import { getApps, initializeApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { FIREBASE_CONFIG } from '../environment/firebase.config';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly db: Firestore;

  constructor() {
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    this.db = getFirestore(app);
  }
}
