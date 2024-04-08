import {Component, Input, OnInit} from '@angular/core';
import {FormArray, FormControl, FormGroup, Validators} from '@angular/forms';
import {FileNotFoundHandling, GdalDatasetParameters, RasterPropertiesEntryType} from '@geoengine/openapi-client';

export interface GdalDatasetParametersForm {
    filePath: FormControl<string>;
    rasterbandChannel: FormControl<number>;
    geoTransform: FormGroup<GdalDatasetGeoTransformForm>;
    width: FormControl<number>;
    height: FormControl<number>;
    fileNotFoundHandling: FormControl<FileNotFoundHandling>;
    noDatavalue: FormControl<number>;
    propertiesMapping: FormArray<FormGroup<GdalMetadataMappingForm>>;
    gdalOpenOptions: FormArray<FormControl<string>>;
    gdalConfigOptions: FormArray<FormGroup<GdalConfigOptionForm>>;
    allowAlphabandAsMask: FormControl<boolean>;
}

export interface GdalDatasetGeoTransformForm {
    originCoordinateX: FormControl<number>;
    originCoordinateY: FormControl<number>;
    xPixelSize: FormControl<number>;
    yPixelSize: FormControl<number>;
}

export interface GdalMetadataMappingForm {
    sourceDomain: FormControl<string>;
    sourceKey: FormControl<string>;
    targetDomain: FormControl<string>;
    targetKey: FormControl<string>;
    targetType: FormControl<RasterPropertiesEntryType>;
}

export interface GdalConfigOptionForm {
    key: FormControl<string>;
    value: FormControl<string>;
}

@Component({
    selector: 'geoengine-manager-gdal-dataset-parameters',
    templateUrl: './gdal-dataset-parameters.component.html',
    styleUrl: './gdal-dataset-parameters.component.scss',
})
export class GdalDatasetParametersComponent implements OnInit {
    @Input()
    form: FormGroup<GdalDatasetParametersForm> = GdalDatasetParametersComponent.setUpPlaceholderForm();

    FileNotFoundHandling = Object.values(FileNotFoundHandling);
    RasterPropertiesEntryType = Object.values(RasterPropertiesEntryType);

    ngOnInit(): void {
        this.form = GdalDatasetParametersComponent.setUpPlaceholderForm();
    }

    suggest(): void {}

    removePropertyMapping(i: number): void {
        this.form.controls.propertiesMapping.removeAt(i);
        this.form.markAsDirty();
    }

    addPropertyMapping(): void {
        this.form.controls.propertiesMapping.push(
            new FormGroup<GdalMetadataMappingForm>({
                sourceDomain: new FormControl('newSourceDomain', {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
                sourceKey: new FormControl('newSourceKey', {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
                targetDomain: new FormControl('newTargetDomain', {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
                targetKey: new FormControl('newTargetKey', {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
                targetType: new FormControl(RasterPropertiesEntryType.String, {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
            }),
        );
    }

    removeOpenOption(i: number): void {
        this.form.controls.gdalOpenOptions.removeAt(i);
        this.form.markAsDirty();
    }

    addOpenOption(): void {
        this.form.controls.gdalOpenOptions.push(
            new FormControl('newOption', {
                nonNullable: true,
                validators: [Validators.required],
            }),
        );
    }

    removeConfigOption(i: number): void {
        this.form.controls.gdalConfigOptions.removeAt(i);
        this.form.markAsDirty();
    }

    addConfigOption(): void {
        this.form.controls.gdalConfigOptions.push(
            new FormGroup<GdalConfigOptionForm>({
                key: new FormControl('newKey', {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
                value: new FormControl('newValue', {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
            }),
        );
    }

    static setUpPlaceholderForm(): FormGroup<GdalDatasetParametersForm> {
        return this.setUpForm(this.placeHolderGdalParams());
    }

    static placeHolderGdalParams(): GdalDatasetParameters {
        return {
            filePath: 'path/to/file',
            rasterbandChannel: 1,
            geoTransform: {
                originCoordinate: {x: 0, y: 0},
                xPixelSize: 1,
                yPixelSize: -1,
            },
            width: 1000,
            height: 1000,
            fileNotFoundHandling: FileNotFoundHandling.NoData,
            noDataValue: 0,
            propertiesMapping: [
                {
                    sourceKey: {domain: 'sourceDomain', key: 'sourceKey'},
                    targetKey: {domain: 'targetDomain', key: 'targetKey'},
                    targetType: RasterPropertiesEntryType.String,
                },
                {
                    sourceKey: {domain: 'sourceDomain2', key: 'sourceKey2'},
                    targetKey: {domain: 'targetDomain2', key: 'targetKey2'},
                    targetType: RasterPropertiesEntryType.Number,
                },
            ],
            gdalOpenOptions: ['option1', 'option2'],
            gdalConfigOptions: [
                ['option1', 'value1'],
                ['option2', 'value2'],
            ],
            allowAlphabandAsMask: false,
        };
    }

    static setUpForm(gdalParams: GdalDatasetParameters): FormGroup<GdalDatasetParametersForm> {
        return new FormGroup<GdalDatasetParametersForm>({
            filePath: new FormControl(gdalParams.filePath, {
                nonNullable: true,
                validators: [Validators.required], // TODO: check is relative file path
            }),
            rasterbandChannel: new FormControl(gdalParams.rasterbandChannel, {
                nonNullable: true,
                validators: [Validators.required], // TODO: check > 0
            }),
            geoTransform: new FormGroup<GdalDatasetGeoTransformForm>({
                originCoordinateX: new FormControl(gdalParams.geoTransform.originCoordinate.x, {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
                originCoordinateY: new FormControl(gdalParams.geoTransform.originCoordinate.y, {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
                xPixelSize: new FormControl(gdalParams.geoTransform.xPixelSize, {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
                yPixelSize: new FormControl(gdalParams.geoTransform.yPixelSize, {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
            }),
            width: new FormControl(gdalParams.width, {
                nonNullable: true,
                validators: [Validators.required],
            }),
            height: new FormControl(gdalParams.height, {
                nonNullable: true,
                validators: [Validators.required],
            }),
            fileNotFoundHandling: new FormControl(gdalParams.fileNotFoundHandling, {
                nonNullable: true,
                validators: [Validators.required],
            }),
            noDatavalue: new FormControl(gdalParams.noDataValue ?? 0, {
                nonNullable: true,
                validators: [Validators.required],
            }),
            propertiesMapping: new FormArray<FormGroup<GdalMetadataMappingForm>>(
                gdalParams.propertiesMapping?.map((m) => {
                    return new FormGroup<GdalMetadataMappingForm>({
                        sourceDomain: new FormControl(m.sourceKey.domain ?? '', {
                            nonNullable: true,
                            validators: [Validators.required],
                        }),
                        sourceKey: new FormControl(m.sourceKey.key, {
                            nonNullable: true,
                            validators: [Validators.required],
                        }),
                        targetDomain: new FormControl(m.targetKey.domain ?? '', {
                            nonNullable: true,
                            validators: [Validators.required],
                        }),
                        targetKey: new FormControl(m.targetKey.key, {
                            nonNullable: true,
                            validators: [Validators.required],
                        }),
                        targetType: new FormControl(m.targetType, {
                            nonNullable: true,
                            validators: [Validators.required],
                        }),
                    });
                }) ?? [],
            ),
            gdalOpenOptions: new FormArray<FormControl<string>>(
                gdalParams.gdalOpenOptions?.map(
                    (o) =>
                        new FormControl(o, {
                            nonNullable: true,
                            validators: [Validators.required],
                        }),
                ) ?? [],
            ),
            gdalConfigOptions: new FormArray<FormGroup<GdalConfigOptionForm>>(
                gdalParams.gdalConfigOptions?.map((o) => {
                    return new FormGroup<GdalConfigOptionForm>({
                        key: new FormControl(o[0] ?? '', {
                            nonNullable: true,
                            validators: [Validators.required],
                        }),
                        value: new FormControl(o[1] ?? '', {
                            nonNullable: true,
                            validators: [Validators.required],
                        }),
                    });
                }) ?? [],
            ),
            allowAlphabandAsMask: new FormControl(gdalParams.allowAlphabandAsMask ?? false, {
                nonNullable: true,
                validators: [Validators.required],
            }),
        });
    }
}
