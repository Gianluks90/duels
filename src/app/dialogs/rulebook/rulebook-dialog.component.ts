import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { SelectComponent, type SelectOption } from '../../components/ui/select/select.component';
import { BoardLayoutService } from '../../services/board-layout.service';
import { AuthService } from '../../services/auth.service';
import { TranslatePipe } from '../../pipes/translate.pipe';

interface RulebookSection {
  id: string;
  title: string;
  contentUrl: string;
}

@Component({
  selector: 'app-rulebook-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, SelectComponent, TranslatePipe],
  templateUrl: './rulebook-dialog.component.html',
  styleUrl: './rulebook-dialog.component.scss',
})
export class RulebookDialogComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly boardLayout = inject(BoardLayoutService);
  private readonly auth = inject(AuthService);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

  /** Sotto i 1024px (stessa soglia usata da BoardLayoutService per il layout compatto della board) la
   * navigazione a due colonne (nav a sinistra + contenuto a destra) non ha più spazio per stare
   * fianco a fianco — sotto quella soglia la nav diventa una select a tutta larghezza sopra il
   * contenuto, che scorre sotto invece che affiancato. */
  protected readonly compact = computed(() => this.boardLayout.tier() !== 'desktop');

  protected readonly sections = signal<RulebookSection[]>([]);
  protected readonly activeId = signal<string>('');
  protected readonly renderedContent = signal<SafeHtml>('');
  protected readonly loading = signal(true);

  protected readonly sectionOptions = computed<SelectOption<string>[]>(() =>
    this.sections().map((s) => ({ value: s.id, label: s.title })),
  );

  private readonly cache = new Map<string, string>();

  async ngOnInit(): Promise<void> {
    const res = await fetch('/config/regolamento.json');
    const data: RulebookSection[] = await res.json();
    this.sections.set(data);
    if (data.length > 0) {
      await this.loadSection(data[0].id);
    }
    this.loading.set(false);
  }

  protected async selectSection(id: string): Promise<void> {
    if (id === this.activeId()) return;
    await this.loadSection(id);
  }

  private async loadSection(id: string): Promise<void> {
    this.activeId.set(id);
    this.loading.set(true);

    if (!this.cache.has(id)) {
      const section = this.sections().find((s) => s.id === id);
      if (section) {
        const res = await fetch(section.contentUrl);
        const markdown = await res.text();
        this.cache.set(id, markdown);
      }
    }

    const markdown = this.cache.get(id) ?? '';
    const html = marked.parse(markdown) as string;
    this.renderedContent.set(this.sanitizer.bypassSecurityTrustHtml(html));
    this.loading.set(false);

    // Achievements "Istruito"/"Istruita" — "letto tutto il regolamento" = ogni sezione aperta
    // almeno una volta in questa (o una precedente) apertura della dialog: `cache` accumula già le
    // sezioni visitate, riusarlo evita un secondo set di "visto/non visto" in parallelo.
    // markRulebookRead() è no-op oltre la prima volta, sicuro da richiamare ad ogni sezione.
    if (this.sections().length > 0 && this.cache.size >= this.sections().length) {
      void this.auth.markRulebookRead();
    }
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
