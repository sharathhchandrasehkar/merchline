import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/home.page').then((m) => m.HomePage), title: 'Merchline' },
  { path: 'explore/:entity', loadComponent: () => import('./pages/list.page').then((m) => m.ListPage), title: 'Explore · Merchline' },
  { path: 'explore/:entity/:id', loadComponent: () => import('./pages/record.page').then((m) => m.RecordPage), title: 'Record · Merchline' },
  { path: 'trace', loadComponent: () => import('./pages/trace.page').then((m) => m.TracePage), title: 'Trace to season · Merchline' },
  { path: 'overview', loadComponent: () => import('./pages/overview.page').then((m) => m.OverviewPage), title: 'Overview · Merchline' },
  { path: '**', redirectTo: '' },
];
