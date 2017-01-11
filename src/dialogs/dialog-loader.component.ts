import {
  Component, ChangeDetectionStrategy, ViewChild, ComponentFactory, AfterViewInit,
  ComponentRef, Input, ViewContainerRef, ComponentFactoryResolver, ChangeDetectorRef, OnDestroy, Type,
} from '@angular/core';

import {BehaviorSubject, Observable, Subscription} from 'rxjs/Rx';

import {MdBackdrop} from 'ng2-material';
import {MdDialog} from 'ng2-material';

import {DialogRef, ButtonDescription, ActionInputDescription} from './dialog-ref.model';
import {DefaultBasicDialog, DialogInput} from './basic-dialog.component';

@Component({
    selector: 'wave-dialog-loader',
    template: `
    <md-dialog>
        <md-toolbar class="md-primary">
            <span>{{title | async}}</span>
            <button md-button class="md-icon-button" aria-label="Close Dialog" (click)="close()">
                <i md-icon>close</i>
            </button>
        </md-toolbar>
        <md-content
            [style.maxHeight.px]="maxHeight$ | async"
            [style.maxWidth.px]="maxWidth$ | async"
            [class.no-overflow]="!(overflows | async)"
            [class.no-side-margins]="!(sideMargins | async)"
        >
            <template #target></template>
        </md-content>
        <md-dialog-actions *ngIf="(buttons | async).length > 0">
            <button md-button type="button"
                *ngFor="let buttonProperties of buttons | async"
                [class]="buttonProperties.class"
                (click)="buttonProperties.action()"
                [attr.aria-label]="buttonProperties.title"
                [disabled]="buttonProperties.disabled | async"
            >{{buttonProperties.title}}</button>
        </md-dialog-actions>
    </md-dialog>
    <md-backdrop class="md-opaque" (click)="close()"></md-backdrop>
    `,
    styles: [`
    md-toolbar,
    md-toolbar >>> .md-toolbar-layout,
    md-toolbar >>> md-toolbar-row{
        height: 48px;
        min-height: 48px;
    }
    md-toolbar {
        margin-top: -24px;
        margin-left: -24px;
        margin-right: -24px;
        width: calc(100% + 2*24px);
    }
    i {
        color: #fff;
    }
    span {
        flex: 1 1 auto;
    }
    md-content {
        margin-left: -24px;
        padding-left: 24px;
        margin-right: -24px;
        padding-right: 24px;
    }
    md-content.no-overflow {
        overflow: hidden;
    }
    md-content.no-side-margins {
        padding-left: 0;
        padding-right: 0;
    }
    md-dialog-actions {
        height: 52px;
        padding-top: 8px;
    }
    `],
    changeDetection: ChangeDetectionStrategy.Default,
})
export class DialogLoaderComponent implements AfterViewInit, OnDestroy {
    @ViewChild(MdDialog) dialog: MdDialog;
    @ViewChild('target', {read: ViewContainerRef}) target: ViewContainerRef;
    @ViewChild(MdBackdrop) backdrop: MdBackdrop;

    @Input() type: Type<DefaultBasicDialog>;
    @Input() config: DialogInput = {}; // optional

    dialogChild: ComponentRef<DefaultBasicDialog>;

    dialogIsOpen = new BehaviorSubject(false);

    // These properties get changed from the child component.
    title = new BehaviorSubject('');
    buttons = new BehaviorSubject<Array<ButtonDescription>>([]);
    actionInput = new BehaviorSubject<ActionInputDescription>(undefined);
    overflows = new BehaviorSubject(true);
    sideMargins = new BehaviorSubject(true);

    private dialogRef: DialogRef;

    private maxHeight$: Observable<number>;
    private maxWidth$: Observable<number>;

    private windowHeight$: BehaviorSubject<number>;
    private windowWidth$: BehaviorSubject<number>;

    private subscriptions: Array<Subscription> = [];

    constructor(
        private componentResolver: ComponentFactoryResolver,
        private changeDetectorRef: ChangeDetectorRef
    ) {
        this.windowHeight$ = new BehaviorSubject(window.innerHeight);
        this.subscriptions.push(
            Observable.fromEvent(window, 'resize')
                      .map(_ => window.innerHeight)
                      .subscribe(this.windowHeight$)
        );

        this.windowWidth$ = new BehaviorSubject(window.innerWidth);
        this.subscriptions.push(
            Observable.fromEvent(window, 'resize')
                      .map(_ => window.innerWidth)
                      .subscribe(this.windowWidth$)
        );

        const MARGIN = 48;
        const DIALOG_ACTIONS_HEIGHT = 52 + 8; // height + margin

        this.maxHeight$ = Observable.combineLatest(
            this.windowHeight$,
            Observable.from([2 * MARGIN]), // TODO: replace with `just`
            this.buttons.map(buttons => buttons.length > 0 ? DIALOG_ACTIONS_HEIGHT : 0),
            (windowHeight, margins, buttonsHeight) => windowHeight - margins - buttonsHeight
        );
        this.maxWidth$ = Observable.combineLatest(
            this.windowWidth$,
            this.sideMargins.map(sideMargins => sideMargins ? 2 * MARGIN : 0),
            (windowWidth, margins) => windowWidth - margins
        );

        this.dialogRef = {
            maxHeight$: this.maxHeight$,
            maxWidth$: this.maxWidth$,
            maxHeight: undefined,
            maxWidth: undefined,
            setTitle: title => this.title.next(title),
            setButtons: buttons => this.buttons.next(
                buttons.map(button => {
                    if (!button.disabled) {
                        button.disabled = new BehaviorSubject(false);
                    }
                    return button;
                })
            ),
            setOverflows: overflows => this.overflows.next(overflows),
            setSideMargins: sideMargins => this.sideMargins.next(sideMargins),
            close: () => this.close(),
        };

        this.subscriptions.push(
            this.maxHeight$.subscribe(maxHeight => this.dialogRef.maxHeight = maxHeight)
        );
        this.subscriptions.push(
            this.maxWidth$.subscribe(maxWidth => this.dialogRef.maxWidth = maxWidth)
        );
    }

    ngAfterViewInit() {
        // make dialog behave according to this subject
        this.subscriptions.push(
            this.dialogIsOpen.subscribe(isOpen => {
                if (isOpen) {
                    this.createChildComponent().then(() => {
                        this.backdrop.show();
                        this.dialog.show().then(dialog => {
                            setTimeout(() => this.changeDetectorRef.markForCheck());
                        });
                    });
                } else {
                    this.dialog.close();
                    this.backdrop.hide();
                    this.destroyChildComponent();
                }
            })
        );
    }

    ngOnDestroy() {
        for (const subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
    }

    show(config: DialogInput = undefined) {
        if (config) {
            this.config = config; // TODO: separate input from parameter?
        }
        this.dialogIsOpen.next(true);
    }

    close() {
        this.dialogIsOpen.next(false);
    }

    private createChildComponent(): Promise<void> {
        if (this.type) {
            this.destroyChildComponent();

          this.dialogChild = this.componentResolver.resolveComponentFactory(this.type).create(this.target);
                // inject
          this.dialogChild.instance.dialog = this.dialogRef;
          this.dialogChild.instance.dialogInput = this.config;
          return Observable.empty().toPromise(); // FIXME: WTF???

        } else {
            throw 'DialogLoader: There is no Component to load.';
        }
    }

    private destroyChildComponent() {
        if (this.dialogChild) {
            this.dialogChild.destroy();
        }
    }
}
