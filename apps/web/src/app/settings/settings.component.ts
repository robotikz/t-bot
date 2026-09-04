import { Component } from '@angular/core';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `
    <section class="card">
      <h1>Settings</h1>
      <p>Configuration placeholders for future features.</p>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .card {
        padding: 2rem;
        border-radius: 16px;
        background: #ffffff;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      }

      h1 {
        margin: 0 0 0.75rem;
      }

      p {
        margin: 0;
      }
    `,
  ],
})
export class SettingsComponent {}
