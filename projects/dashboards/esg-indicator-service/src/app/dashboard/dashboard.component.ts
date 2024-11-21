import {
    AfterContentInit,
    AfterViewInit,
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    effect,
    ElementRef,
    inject,
    signal,
    untracked,
    viewChild,
    WritableSignal,
} from '@angular/core';
import {Breakpoints, BreakpointObserver} from '@angular/cdk/layout';
import {AsyncPipe} from '@angular/common';
import {MatGridListModule} from '@angular/material/grid-list';
import {MatMenuModule} from '@angular/material/menu';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatCardModule} from '@angular/material/card';
import {firstValueFrom} from 'rxjs';
import {
    BackendService,
    BBoxDict,
    CoreModule,
    DatasetService,
    MapContainerComponent,
    NotificationService,
    ProjectService,
    UserService,
    WfsParamsDict,
} from '@geoengine/core';
import {
    ColumnRangeFilterDict,
    extentToBboxDict,
    PolygonSymbology,
    RasterVectorJoinDict,
    SourceOperatorDict,
    Time,
    VectorLayer,
    VectorSymbology,
    UserService as CommonUserService,
    ColorMapSelectorComponent,
    ALL_COLORMAPS,
    ColorBreakpoint,
} from '@geoengine/common';
import {utc} from 'moment';
import {DataSelectionService} from '../data-selection.service';
import {ComputationQuota, Workflow} from '@geoengine/openapi-client';
import {LegendComponent} from '../legend/legend.component';
import {toSignal} from '@angular/core/rxjs-interop';
import {Router} from '@angular/router';
import proj4 from 'proj4';
import {MatProgressSpinner} from '@angular/material/progress-spinner';

interface SelectedProperty {
    featureId: number;
    bbox: BBoxDict;
}

@Component({
    selector: 'geoengine-dashboard',
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CoreModule, AsyncPipe, MatGridListModule, MatMenuModule, MatIconModule, MatButtonModule, MatCardModule, LegendComponent],
})
export class DashboardComponent implements AfterViewInit, AfterContentInit {
    readonly userService = inject(UserService);
    readonly commonUserService = inject(CommonUserService);
    readonly dataSelectionService = inject(DataSelectionService);
    private readonly breakpointObserver = inject(BreakpointObserver);
    private readonly projectService = inject(ProjectService);
    private readonly notificationService = inject(NotificationService);
    private readonly datasetService = inject(DatasetService);
    private readonly changeDetectorRef = inject(ChangeDetectorRef);
    private readonly backend = inject(BackendService);
    private readonly router = inject(Router);

    maxScore = 2;

    isSelectingBox = signal(false);
    selectedFeature: WritableSignal<SelectedProperty | undefined> = signal(undefined);
    isLandscape = signal(true);
    plotWidthPx = signal(100);
    plotHeightPx = signal(100);
    layersReverse = toSignal(this.dataSelectionService.layers);
    scoreLoading = signal(false);
    score = signal<number | undefined>(undefined);

    usageLoading = signal(false);
    usage = signal<ComputationQuota | undefined>(undefined);

    mapComponent = viewChild.required(MapContainerComponent);

    analyzeCard = viewChild.required('analyzecard', {read: ElementRef});

    timeSteps: Time[] = [new Time(utc('2022-01-01')), new Time(utc('2023-01-01'))];

    readonly scoreIndicator = viewChild<MatProgressSpinner>('scoreIndicator');
    readonly scoreColors = ColorMapSelectorComponent.createLinearBreakpoints(ALL_COLORMAPS['RdYlGn'], 16, false, {
        min: 0,
        max: this.maxScore,
    });

    constructor() {
        effect(() => {
            const [score, scoreIndicator] = [this.score(), this.scoreIndicator()];
            if (!score || !scoreIndicator) return;
            untracked(() => colorizeScoreIndicator(scoreIndicator, score, this.scoreColors));
        });
    }

    async ngAfterViewInit(): Promise<void> {
        this.breakpointObserver.observe(Breakpoints.Web).subscribe((isLandscape) => {
            this.isLandscape.set(isLandscape.matches);
        });
    }

    async ngAfterContentInit(): Promise<void> {
        await this.loadProperties();

        this.projectService.getSelectedFeatureStream().subscribe(async (featureSelection) => {
            const features = await this.dataSelectionService.getPolygonLayerFeatures();
            if (featureSelection.feature) {
                const actualFeature = features.find((f) => f.getId() === featureSelection.feature);
                const props = actualFeature?.getProperties();
                const id = props?.[PROPERTY_IDENTIFIER_COLUMN_NAME];
                const bbox = actualFeature?.getGeometry()?.getExtent();

                if (!id || !bbox) {
                    // TODO: show error message

                    this.selectedFeature.set(undefined);
                    return;
                }

                this.selectedFeature.set({
                    featureId: id,
                    bbox: {
                        lowerLeftCoordinate: {x: bbox[0], y: bbox[1]},
                        upperRightCoordinate: {x: bbox[2], y: bbox[3]},
                    },
                });
            } else {
                this.selectedFeature.set(undefined);
            }
        });
    }

    async loadProperties(): Promise<void> {
        const workflowId = await firstValueFrom(this.projectService.registerWorkflow(PROPERTIES_WORKFLOW));

        const polygonLayer = new VectorLayer({
            name: 'Bahn Properties',
            workflowId,
            isVisible: true,
            isLegendVisible: false,
            symbology: PROPERTIES_SYMBOLOGY,
        });

        return await firstValueFrom(this.dataSelectionService.setPolygonLayer(polygonLayer));
    }

    async analyze(): Promise<void> {
        const feature = this.selectedFeature();
        if (!feature) {
            return;
        }

        this.scoreLoading.set(true);

        const columnFilter: ColumnRangeFilterDict = {
            type: 'ColumnRangeFilter',
            params: {
                column: PROPERTY_IDENTIFIER_COLUMN_NAME,
                ranges: [[feature.featureId, feature.featureId]],
                keepNulls: false,
            },
            sources: {
                vector: PROPERTIES_SOURCE_OP,
            },
        };

        const rasterVectorJoin: RasterVectorJoinDict = {
            type: 'RasterVectorJoin',
            params: {
                names: {
                    type: 'names',
                    values: ['score'],
                },
                featureAggregation: 'mean',
                temporalAggregation: 'mean',
                featureAggregationIgnoreNoData: true,
                temporalAggregationIgnoreNoData: true,
            },
            sources: {
                vector: columnFilter,
                rasters: [
                    {
                        type: 'GdalSource',
                        params: {
                            data: 'esg',
                        },
                    },
                ],
            },
        };

        const workflow: Workflow = {
            type: 'Vector',
            operator: rasterVectorJoin,
        };

        const workflowId = await firstValueFrom(this.projectService.registerWorkflow(workflow));

        const time = await this.projectService.getTimeOnce();

        // reproject bbox to EPSG:32632
        const ll = proj4('EPSG:4326', 'EPSG:32632', [feature.bbox.lowerLeftCoordinate.x, feature.bbox.lowerLeftCoordinate.y]);
        const ur = proj4('EPSG:4326', 'EPSG:32632', [feature.bbox.upperRightCoordinate.x, feature.bbox.upperRightCoordinate.y]);
        const extent: [number, number, number, number] = [ll[0], ll[1], ur[0], ur[1]];

        const wfsParams: WfsParamsDict = {
            workflowId,
            bbox: extentToBboxDict(extent),
            time: {
                start: time.start.unix() * 1_000,
                end: time.end.unix() * 1_000,
            },
            queryResolution: CLASSIFICATION_RESOLUTION,
            srsName: 'EPSG:32632',
        };

        const sessionId = await firstValueFrom(this.userService.getSessionTokenForRequest());

        const wfsResponse = await firstValueFrom(this.backend.wfsGetFeature(wfsParams, sessionId));

        const features = wfsResponse?.features;
        if (!Array.isArray(features) || features.length === 0) {
            // TODO: show error
            return;
        }

        const score = features[0].properties?.score;

        if (!score) {
            // TODO: show error
            return;
        }

        this.score.set(score);
        this.scoreLoading.set(false);

        this.usageLoading.set(true);
        const usage = await this.commonUserService.computationsQuota(workflowId, 1);

        if (usage.length > 0) {
            this.usage.set(usage[0]);
        }

        this.usageLoading.set(false);
    }

    async reset(): Promise<void> {
        await firstValueFrom(this.dataSelectionService.clearPolygonLayer());
        this.changeDetectorRef.markForCheck();
    }

    logout(): void {
        this.userService.logout();
        this.router.navigate(['/signin']);
    }
}

const PROPERTIES_SOURCE_OP: SourceOperatorDict = {
    type: 'OgrSource',
    params: {data: 'bahn_properties'},
};

const PROPERTIES_WORKFLOW: Workflow = {
    type: 'Vector',
    operator: PROPERTIES_SOURCE_OP,
};

const PROPERTY_IDENTIFIER_COLUMN_NAME = 'identifier';

const PROPERTIES_SYMBOLOGY: VectorSymbology = PolygonSymbology.fromPolygonSymbologyDict({
    type: 'polygon',
    stroke: {
        width: {
            type: 'static',
            value: 2,
        },
        color: {
            type: 'static',
            color: [128, 0, 0, 255],
        },
    },
    fillColor: {
        type: 'static',
        color: [128, 0, 0, 128],
    },
    autoSimplified: true,
});

const CLASSIFICATION_RESOLUTION = 10;

/** Colorizes the score indicator based on the given score and breakpoints */
function colorizeScoreIndicator(element: MatProgressSpinner, score: number, breakpoints: Array<ColorBreakpoint>): void {
    const circle = element._elementRef.nativeElement.getElementsByTagName('circle')[0];
    if (!circle || breakpoints.length === 0) {
        return;
    }

    let color = breakpoints[0].color;
    for (const breakpoint of breakpoints) {
        if (score < breakpoint.value) {
            break;
        }
        color = breakpoint.color;
    }

    circle.style.stroke = color.rgbaCssString();
}
