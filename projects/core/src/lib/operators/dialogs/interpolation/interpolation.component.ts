import {RasterLayer} from '../../../layers/layer.model';
import {ResultTypes} from '../../result-type.model';
import {AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, OnInit} from '@angular/core';
import {FormControl, FormBuilder, FormGroup, Validators, ValidatorFn} from '@angular/forms';
import {ProjectService} from '../../../project/project.service';
import {geoengineValidators} from '../../../util/form.validators';
import {mergeMap, tap} from 'rxjs/operators';
import {NotificationService} from '../../../notification.service';
import {WorkflowDict} from '../../../backend/backend.model';
import {Subscription} from 'rxjs';
import {InputResolutionDict, InterpolationDict} from '../../../backend/operator.model';
import {RasterDataTypes} from '../../datatype.model';
import {Layer} from 'ol/layer';

@Component({
    selector: 'geoengine-interpolation',
    templateUrl: './interpolation.component.html',
    styleUrls: ['./interpolation.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InterpolationComponent implements OnInit, AfterViewInit, OnDestroy {
    readonly interpolationMethods = [
        ['Nearest Neighbor', 'nearestNeighbor'],
        ['Bilinear', 'biLinear'],
    ];
    readonly inputTypes = [ResultTypes.RASTER];
    readonly rasterDataTypes = RasterDataTypes.ALL_DATATYPES;

    form: FormGroup;

    private subscription!: Subscription;

    constructor(
        private readonly projectService: ProjectService,
        private readonly notificationService: NotificationService,
        private readonly formBuilder: FormBuilder,
    ) {
        this.form = this.formBuilder.group({
            name: ['', [Validators.required, geoengineValidators.notOnlyWhitespace]],
            layer: new FormControl<Layer | null>(null, {validators: Validators.required}),
            interpolationMethod: new FormControl(this.interpolationMethods[0][1], {
                nonNullable: true,
                validators: [Validators.required],
            }),
            inputResolution: new FormControl('source', {
                nonNullable: true,
                validators: [Validators.required],
            }),
            inputResolutionX: new FormControl(1.0, {
                nonNullable: true,
                validators: [this.resolutionValidator()],
            }),
            inputResolutionY: new FormControl(1.0, {
                nonNullable: true,
                validators: [this.resolutionValidator()],
            }),
        });
        this.subscription = this.form.controls['inputResolution'].statusChanges
            .pipe(
                tap((_) => {
                    this.form.updateValueAndValidity();
                    this.form.controls['inputResolutionX'].updateValueAndValidity();
                    this.form.controls['inputResolutionY'].updateValueAndValidity();
                }),
            )
            .subscribe();
    }

    ngOnInit(): void {}

    ngAfterViewInit(): void {
        setTimeout(() => {
            this.form.updateValueAndValidity();
            this.form.controls['layer'].updateValueAndValidity();
        });
    }

    ngOnDestroy(): void {
        this.subscription.unsubscribe();
    }

    add(): void {
        const inputLayer: RasterLayer = this.form.controls['layer'].value;
        const outputName: string = this.form.controls['name'].value;

        const interpolationMethod: string = this.form.controls['interpolationMethod'].value;

        const inputResolution: InputResolutionDict = this.getInputResolution();

        this.projectService
            .getWorkflow(inputLayer.workflowId)
            .pipe(
                mergeMap((inputWorkflow: WorkflowDict) =>
                    this.projectService.registerWorkflow({
                        type: 'Raster',
                        operator: {
                            type: 'Interpolation',
                            params: {
                                interpolation: interpolationMethod,
                                inputResolution,
                            },
                            sources: {
                                raster: inputWorkflow.operator,
                            },
                        } as InterpolationDict,
                    }),
                ),
                mergeMap((workflowId) =>
                    this.projectService.addLayer(
                        new RasterLayer({
                            workflowId,
                            name: outputName,
                            symbology: inputLayer.symbology.clone(),
                            isLegendVisible: false,
                            isVisible: true,
                        }),
                    ),
                ),
            )
            .subscribe(
                () => {
                    // success
                },
                (error) => this.notificationService.error(error.error.message),
            );
    }

    private getInputResolution(): InputResolutionDict {
        const inputResolution = this.form.controls['inputResolution'].value;

        if (inputResolution === 'source') {
            return {
                type: 'source',
            };
        } else if (inputResolution === 'value') {
            return {
                type: 'value',
                x: this.form.controls['inputResolutionX'].value,
                y: this.form.controls['inputResolutionY'].value,
            };
        }

        throw Error('Invalid input resolution');
    }

    private resolutionValidator(): ValidatorFn {
        const validator = Validators.compose([Validators.required, geoengineValidators.largerThan(0.0)]);

        if (!validator) {
            throw Error('Invalid validator');
        }

        return geoengineValidators.conditionalValidator(validator, () => this.form?.get('inputResolution')?.value === 'value');
    }
}