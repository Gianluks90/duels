import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { TranslationService } from '../../services/translation.service';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ObjectiveCardComponent } from '../../components/objective-card/objective-card.component';
import { AppHeaderComponent } from '../../components/app-header/app-header.component';
import { OBJECTIVE_CATALOG } from '../../data/objectives';
import { OBJECTIVE_CATEGORY_CATALOG } from '../../data/objective-categories';
import { buildObjectiveProgress, buildProgressSource } from '../../game/achievements';

/** Pagina Obiettivi (Achievements): stesso schema a due colonne di CollectionComponent (nav
 * categorie a sinistra, griglia a destra) invece di un'unica lista lunga. Le categorie vengono da
 * OBJECTIVE_CATEGORY_CATALOG (raggruppamento di ObjectiveMetric, es. "Esito duello" copre
 * gamesPlayed/wins/losses insieme), non più 1:1 con le metriche. Stesso ObjectiveCardComponent/
 * buildObjectiveProgress usati dalla colonna a fine partita (result.component.ts). Stesso
 * AppHeaderComponent di Home/Collezione: navigazione continua. */
@Component({
  selector: 'app-objectives',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display: block' },
  imports: [TranslatePipe, ObjectiveCardComponent, AppHeaderComponent],
  templateUrl: './objectives.component.html',
  styleUrl: './objectives.component.scss',
})
export class ObjectivesComponent {
  private readonly auth = inject(AuthService);
  protected readonly i18n = inject(TranslationService);

  protected readonly categories = OBJECTIVE_CATEGORY_CATALOG;

  protected readonly selectedCategory = signal<string>(this.categories[0].id);

  protected selectCategory(categoryId: string): void {
    this.selectedCategory.set(categoryId);
  }

  private readonly objectivesProgress = computed(() => {
    const profile = this.auth.profile();
    return buildObjectiveProgress(
      OBJECTIVE_CATALOG,
      buildProgressSource(profile?.stats, profile ?? undefined),
      profile?.claimedObjectiveIds,
    );
  });

  protected readonly visibleObjectives = computed(() => {
    const metrics = this.categories.find((c) => c.id === this.selectedCategory())?.metrics ?? [];
    return this.objectivesProgress().filter((item) => metrics.includes(item.objective.metric));
  });

  protected claimObjective(objectiveId: string): void {
    void this.auth.claimObjective(objectiveId);
  }
}
