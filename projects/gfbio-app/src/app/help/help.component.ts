import {Component, ChangeDetectionStrategy, OnInit} from '@angular/core';

@Component({
    selector: 'wave-gfbio-help',
    templateUrl: 'help.component.html',
    styleUrls: ['./help.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpComponent implements OnInit {
    ngOnInit() {}
}
