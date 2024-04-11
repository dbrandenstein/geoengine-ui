import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
import {FormArray, FormControl, FormGroup, NG_VALUE_ACCESSOR, Validators} from '@angular/forms';
import {MatSnackBar} from '@angular/material/snack-bar';
import {DatasetsService, errorToText} from '@geoengine/common';
import {
    DataPath,
    FileNotFoundHandling,
    GdalDatasetParameters,
    GdalMetaDataList,
    RasterPropertiesEntryType,
} from '@geoengine/openapi-client';

export interface GdalMetadataMapping {
    sourceKey: RasterPropertiesKey;
    targetKey: RasterPropertiesKey;
    targetType: RasterPropertiesEntryType;
}

export interface RasterPropertiesKey {
    domain: string;
    key: string;
}

export interface GdalDatasetParametersForm {
    filePath: FormControl<string>;
    rasterbandChannel: FormControl<number>;
    geoTransform: FormGroup<GdalDatasetGeoTransformForm>;
    width: FormControl<number>;
    height: FormControl<number>;
    fileNotFoundHandling: FormControl<FileNotFoundHandling>;
    noDataValue: FormControl<number>;
    propertiesMapping: FormArray<FormGroup<GdalMetadataMappingForm>>;
    gdalOpenOptions: FormArray<FormControl<string>>;
    gdalConfigOptions: FormArray<FormArray<FormControl<string>>>;
    allowAlphabandAsMask: FormControl<boolean>;
}

export interface GdalDatasetGeoTransformForm {
    originCoordinate: FormGroup<OriginCoordinateForm>;
    xPixelSize: FormControl<number>;
    yPixelSize: FormControl<number>;
}

export interface OriginCoordinateForm {
    x: FormControl<number>;
    y: FormControl<number>;
}

export interface GdalMetadataMappingForm {
    sourceKey: FormGroup<RasterPropertiesKeyForm>;
    targetKey: FormGroup<RasterPropertiesKeyForm>;
    targetType: FormControl<RasterPropertiesEntryType>;
}

export interface RasterPropertiesKeyForm {
    domain: FormControl<string>;
    key: FormControl<string>;
}

@Component({
    selector: 'geoengine-manager-gdal-dataset-parameters',
    templateUrl: './gdal-dataset-parameters.component.html',
    styleUrl: './gdal-dataset-parameters.component.scss',
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            multi: true,
            useExisting: GdalDatasetParametersComponent,
        },
    ],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GdalDatasetParametersComponent {
    @Input()
    form: FormGroup<GdalDatasetParametersForm> = GdalDatasetParametersComponent.setUpPlaceholderForm();

    @Input()
    dataPath?: DataPath;

    FileNotFoundHandling = Object.values(FileNotFoundHandling);
    RasterPropertiesEntryType = Object.values(RasterPropertiesEntryType);

    constructor(
        private readonly datasetsService: DatasetsService,
        private readonly snackBar: MatSnackBar,
    ) {}

    async suggest(): Promise<void> {
        if (!this.dataPath) {
            return;
        }

        try {
            const suggestion = await this.datasetsService.suggestMetaData({
                suggestMetaData: {
                    dataPath: this.dataPath,
                    mainFile: this.form.controls.filePath.value,
                },
            });

            if (suggestion.metaData.type !== 'GdalMetaDataList') {
                this.snackBar.open(`Metadata suggestion is not of type "GdalMetaDataList" but ${suggestion.metaData.type}`, 'Close', {
                    panelClass: ['error-snackbar'],
                });
                return;
            }

            const gdalMetaDataList = suggestion.metaData as GdalMetaDataList;
            const slices = gdalMetaDataList.params;

            if (slices.length === 0) {
                this.snackBar.open('No time slices found in metadata suggestion.', 'Close', {panelClass: ['error-snackbar']});
                return;
            }

            const firstSlice = slices[0];
            const gdalParams = firstSlice.params;

            if (!gdalParams) {
                this.snackBar.open('No gdal parameters found in metadata suggestion.', 'Close', {panelClass: ['error-snackbar']});
                return;
            }

            this.form = GdalDatasetParametersComponent.setUpForm(gdalParams);
        } catch (error) {
            const errorMessage = await errorToText(error, 'Metadata suggestion failed.');
            this.snackBar.open(errorMessage, 'Close', {panelClass: ['error-snackbar']});
        }
    }

    removePropertyMapping(i: number): void {
        this.form.controls.propertiesMapping.removeAt(i);
        this.form.markAsDirty();
    }

    addPropertyMapping(): void {
        this.form.controls.propertiesMapping.push(
            new FormGroup<GdalMetadataMappingForm>({
                sourceKey: new FormGroup<RasterPropertiesKeyForm>({
                    domain: new FormControl('newSourceDomain', {
                        nonNullable: true,
                        validators: [Validators.required],
                    }),
                    key: new FormControl('newSourceKey', {
                        nonNullable: true,
                        validators: [Validators.required],
                    }),
                }),
                targetKey: new FormGroup<RasterPropertiesKeyForm>({
                    domain: new FormControl('newTargetDomain', {
                        nonNullable: true,
                        validators: [Validators.required],
                    }),
                    key: new FormControl('newTargetKey', {
                        nonNullable: true,
                        validators: [Validators.required],
                    }),
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
            new FormArray<FormControl<string>>([
                new FormControl('newKey', {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
                new FormControl('newValue', {
                    nonNullable: true,
                    validators: [Validators.required],
                }),
            ]),
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
                originCoordinate: new FormGroup<OriginCoordinateForm>({
                    x: new FormControl(gdalParams.geoTransform.originCoordinate.x, {
                        nonNullable: true,
                        validators: [Validators.required],
                    }),
                    y: new FormControl(gdalParams.geoTransform.originCoordinate.y, {
                        nonNullable: true,
                        validators: [Validators.required],
                    }),
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
            noDataValue: new FormControl(gdalParams.noDataValue ?? 0, {
                nonNullable: true,
                validators: [Validators.required],
            }),
            propertiesMapping: new FormArray<FormGroup<GdalMetadataMappingForm>>(
                gdalParams.propertiesMapping?.map((m) => {
                    return new FormGroup<GdalMetadataMappingForm>({
                        sourceKey: new FormGroup<RasterPropertiesKeyForm>({
                            domain: new FormControl(m.sourceKey.domain ?? '', {
                                nonNullable: true,
                                validators: [Validators.required],
                            }),
                            key: new FormControl(m.sourceKey.key, {
                                nonNullable: true,
                                validators: [Validators.required],
                            }),
                        }),
                        targetKey: new FormGroup<RasterPropertiesKeyForm>({
                            domain: new FormControl(m.targetKey.domain ?? '', {
                                nonNullable: true,
                                validators: [Validators.required],
                            }),
                            key: new FormControl(m.targetKey.key, {
                                nonNullable: true,
                                validators: [Validators.required],
                            }),
                        }),
                        targetType: new FormControl(RasterPropertiesEntryType.String, {
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
            gdalConfigOptions: new FormArray<FormArray<FormControl<string>>>(
                gdalParams.gdalConfigOptions?.map((o) => {
                    return new FormArray<FormControl<string>>([
                        new FormControl(o[0], {
                            nonNullable: true,
                            validators: [Validators.required],
                        }),
                        new FormControl(o[1], {
                            nonNullable: true,
                            validators: [Validators.required],
                        }),
                    ]);
                }) ?? [],
            ),
            allowAlphabandAsMask: new FormControl(gdalParams.allowAlphabandAsMask ?? false, {
                nonNullable: true,
                validators: [Validators.required],
            }),
        });
    }
}
