import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  template: `
    <section class="card">
      <h1>Trading Platform MVP</h1>
      <p>Backend status: {{ backendStatus }}</p>
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
        font-size: clamp(2rem, 3vw, 2.8rem);
      }

      p {
        margin: 0;
        font-size: 1.1rem;
      }
    `,
  ],
})
export class DashboardComponent implements OnInit {
  backendStatus = 'Checking...';

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.http
      .get<{ status: string }>('http://localhost:3000/api/health')
      .subscribe({
        next: (response) => {
          this.backendStatus = response.status === 'ok' ? 'OK' : response.status;
        },
        error: () => {
          this.backendStatus = 'ERROR';
        },
      });
  }
}
