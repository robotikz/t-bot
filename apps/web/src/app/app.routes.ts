import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'scanner', pathMatch: 'full' },
  { path: 'scanner', loadComponent: () => import('./scanner/scanner.component').then((module) => module.ScannerComponent) },
  { path: 'trading', loadComponent: () => import('./trading/trading.component').then((module) => module.TradingComponent) },
  { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard.component').then((module) => module.DashboardComponent) },
  { path: 'settings', loadComponent: () => import('./settings/settings.component').then((module) => module.SettingsComponent) },
];
