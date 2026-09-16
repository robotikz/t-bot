import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard.component';
import { SettingsComponent } from './settings/settings.component';
import { TradingComponent } from './trading/trading.component';

export const routes: Routes = [
  { path: '', redirectTo: 'trading', pathMatch: 'full' },
  { path: 'trading', component: TradingComponent },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'settings', component: SettingsComponent },
];
