import {AfterViewInit, ChangeDetectionStrategy, Component, ViewChild} from '@angular/core';
import {FormControl, FormBuilder, FormGroup, Validators} from '@angular/forms';
import {ProjectService} from '../../../project/project.service';
import {geoengineValidators} from '../../../util/form.validators';
import {map, mergeMap} from 'rxjs/operators';
import {NotificationService} from '../../../notification.service';
import {concat, Observable} from 'rxjs';
import {Layer} from 'ol/layer';
import {RasterDataType, RasterDataTypes, RasterLayer, RasterTypeConversionDict, ResultTypes} from '@geoengine/common';
import {Workflow as WorkflowDict} from '@geoengine/openapi-client';
import {LayerSelectionComponent} from '../helpers/layer-selection/layer-selection.component';

@Component({
    selector: 'geoengine-raster-type-conversion',
    templateUrl: './raster-type-conversion.component.html',
    styleUrls: ['./raster-type-conversion.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RasterTypeConversionComponent implements AfterViewInit {
    readonly inputTypes = [ResultTypes.RASTER];
    readonly rasterDataTypes = RasterDataTypes.ALL_DATATYPES;

    form: FormGroup;
    disallowSubmit: Observable<boolean>;

    @ViewChild('layerSelection') layerSelection!: LayerSelectionComponent;

    constructor(
        private readonly projectService: ProjectService,
        private readonly notificationService: NotificationService,
        private readonly formBuilder: FormBuilder,
    ) {
        this.form = this.formBuilder.group({
            name: ['', [Validators.required, geoengineValidators.notOnlyWhitespace]],
            layer: new FormControl<Layer | null>(null, {validators: Validators.required}),
            dataType: new FormControl(this.rasterDataTypes[0], {
                nonNullable: true,
                validators: [Validators.required],
            }),
        });
        this.disallowSubmit = this.form.statusChanges.pipe(map((status) => status !== 'VALID'));
    }

    ngAfterViewInit(): void {
        setTimeout(() => {
            this.form.updateValueAndValidity();
            this.form.controls['layer'].updateValueAndValidity();
            this.form.controls['dataType'].updateValueAndValidity();
        });
    }

    add(): void {
        const inputLayer: RasterLayer = this.form.controls['layer'].value;
        const outputName: string = this.form.controls['name'].value;

        const outputDataType: RasterDataType = this.form.controls['dataType'].value;

        concat(
            this.projectService.getWorkflow(inputLayer.workflowId).pipe(
                mergeMap((inputWorkflow: WorkflowDict) =>
                    this.projectService.registerWorkflow({
                        type: 'Raster',
                        operator: {
                            type: 'RasterTypeConversion',
                            params: {
                                outputDataType: outputDataType.getCode(),
                            },
                            sources: {
                                raster: inputWorkflow.operator,
                            },
                        } as RasterTypeConversionDict,
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
            ),
            this.layerSelection.deleteIfSelected(),
        ).subscribe(
            () => {
                // success
            },
            (error) => this.notificationService.error(error),
        );
    }
}
