import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { IconButtonComponent } from '../../components/ui/icon-button/icon-button.component';
import { TranslatePipe } from '../../pipes/translate.pipe';

interface RulebookSection {
  id: string;
  title: string;
  contentUrl: string;
}

@Component({
  selector: 'app-rulebook-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, TranslatePipe],
  templateUrl: './rulebook-dialog.component.html',
  styleUrl: './rulebook-dialog.component.scss',
})
export class RulebookDialogComponent implements OnInit {
  private readonly dialogRef = inject(DialogRef);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly closeIcon = '/icons/close_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';

  protected readonly sections = signal<RulebookSection[]>([]);
  protected readonly activeId = signal<string>('');
  protected readonly renderedContent = signal<SafeHtml>('');
  protected readonly loading = signal(true);

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
      const section = this.sections().find(s => s.id === id);
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
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
