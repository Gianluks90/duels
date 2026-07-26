import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ObjectiveCardComponent } from '../../components/objective-card/objective-card.component';
import { OBJECTIVE_CATALOG } from '../../data/objectives';
import { buildObjectiveProgress } from '../../game/achievements';

/** Pagina Obiettivi (Achievements): l'intero catalogo con il progresso dell'utente — stesso
 * ObjectiveCardComponent/buildObjectiveProgress usati dalla colonna a fine partita
 * (result.component.ts), qui senza filtri: si vede tutto, anche ciò che è ancora lontano. */
@Component({
  selector: 'app-objectives',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [TranslatePipe, ObjectiveCardComponent],
  templateUrl: './objectives.component.html',
  styleUrl: './objectives.component.scss',
})
export class ObjectivesComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(TranslationService);

  protected readonly objectivesProgress = computed(() =>
    buildObjectiveProgress(
      OBJECTIVE_CATALOG,
      this.auth.profile()?.stats,
      this.auth.profile()?.claimedObjectiveIds,
    ),
  );

  protected claimObjective(objectiveId: string): void {
    void this.auth.claimObjective(objectiveId);
  }

  protected goHome(): void {
    this.router.navigate(['/home']);
  }
}
