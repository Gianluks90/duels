import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [loginGuard],
  },
  {
    path: 'home',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent),
    canActivate: [authGuard],
  },
  {
    path: 'setup/:gameId',
    loadComponent: () => import('./pages/setup/setup.component').then(m => m.SetupComponent),
    canActivate: [authGuard],
  },
  {
    path: 'game/:gameId',
    loadComponent: () => import('./pages/board/board.component').then(m => m.BoardComponent),
    canActivate: [authGuard],
  },
  {
    path: 'result/:gameId',
    loadComponent: () => import('./pages/result/result.component').then(m => m.ResultComponent),
    canActivate: [authGuard],
  },
  {
    path: 'collection',
    loadComponent: () =>
      import('./pages/collection/collection.component').then(m => m.CollectionComponent),
    canActivate: [authGuard],
  },
  {
    path: 'objectives',
    loadComponent: () =>
      import('./pages/objectives/objectives.component').then(m => m.ObjectivesComponent),
    canActivate: [authGuard],
  },
  {
    path: 'profile/:uid',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard],
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];
