/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Component,
  ElementRef,
  EventEmitter,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {AbstractPopupComponent} from '@common/component/abstract-popup.component';
import {DatasourceInfo, FieldFormatType} from '@domain/datasource/datasource';
import {SchemaConfigureMainComponent} from '../../../../component/schema-configure/schema-configure-main.component';

@Component({
  selector: 'file-configure-schema',
  templateUrl: './file-configure-schema.component.html'
})
export class FileConfigureSchemaComponent extends AbstractPopupComponent implements OnInit, OnDestroy {

  @ViewChild(SchemaConfigureMainComponent, {static: true})
  private readonly _schemaConfigureMainComponent: SchemaConfigureMainComponent;

  // 생성될 데이터소스 정보
  @Input('sourceData')
  public sourceData: DatasourceInfo;

  @Input('step')
  private _step: string;

  @Output('stepChange')
  private _stepChange: EventEmitter<string> = new EventEmitter();

  // 생성자
  constructor(protected element: ElementRef,
              protected injector: Injector) {
    super(element, injector);
  }

  ngOnInit() {
    super.ngOnInit();
    if (this.sourceData.schemaData) {
      this._schemaConfigureMainComponent.initLoadedConfigureData(this.sourceData.schemaData);
    } else {
      this._schemaConfigureMainComponent.init(this.sourceData.fieldList, this.sourceData.fieldData);
    }
  }

  ngOnDestroy() {
    super.ngOnDestroy();
  }

  public onClickPrev() {
    this._saveSchemaConfigureData();
    this._step = 'file-preview';
    this._stepChange.emit(this._step);
  }

  public onClickNext() {
    if (this._isEnableNext()) {
      this._saveSchemaConfigureData();
      this._step = 'file-ingestion';
      this._stepChange.emit(this._step);
    }
  }

  /**
   * Get title
   * @returns {string}
   */
  public get getTitle(): string {
    if (this.sourceData.datasourceId) {
      return this.translateService.instant('msg.storage.ui.dsource.reingestion.title') + ' (' + this.translateService.instant('msg.storage.ui.dsource.create.file.title') + ')';
    } else {
      return this.translateService.instant('msg.storage.ui.dsource.create.title') + ' (' + this.translateService.instant('msg.storage.ui.dsource.create.file.title') + ')';
    }
  }

  private _isEnableNext(): boolean {
    return this._schemaConfigureMainComponent.isExistFieldError();
  }

  private _isChangedTimestamp(configureData): boolean {
    // if exist schema data in source data
    if (this.sourceData.schemaData) {
      // if changed timestamp field
      return (configureData.selectedTimestampType !== this.sourceData.schemaData.selectedTimestampType) ||
        configureData.selectedTimestampField &&
        (configureData.selectedTimestampField.name !== this.sourceData.schemaData.selectedTimestampField.name
          || configureData.selectedTimestampField.format.type !== this.sourceData.schemaData.selectedTimestampField.format.type
          || configureData.selectedTimestampField.format.type === FieldFormatType.UNIX_TIME && this.sourceData.schemaData.selectedTimestampField.format.type === FieldFormatType.UNIX_TIME && configureData.selectedTimestampField.format.unit !== this.sourceData.schemaData.selectedTimestampField.format.unit);
    } else { // if not exist schema data
      return false;
    }
  }

  private _saveSchemaConfigureData() {
    const configureData = this._schemaConfigureMainComponent.getConfigureData();
    configureData['isChangedTimestampField'] = this._isChangedTimestamp(configureData);
    this.sourceData.schemaData = configureData;
  }
}
