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

/**
 * Created by Dolkkok on 2017. 7. 17..
 */

import {AfterViewInit, ElementRef, EventEmitter, Injector, Input, OnDestroy, OnInit, Output} from '@angular/core';
import {AbstractComponent} from '../abstract.component';
import {Pivot} from '@domain/workbook/configurations/pivot';
import {
  UIChartColor,
  UIChartColorByDimension,
  UIChartColorBySeries,
  UIChartColorByValue,
  UIChartColorGradationByValue,
  UIChartZoom,
  UIOption
} from './option/ui-option';
import {BaseOption} from './option/base-option';
import {
  AxisLabelType,
  AxisType,
  BrushType,
  CHART_STRING_DELIMITER,
  ChartAxisLabelType,
  ChartColorList,
  ChartColorType,
  ChartMouseMode,
  ChartPivotType,
  ChartSelectMode,
  ChartType,
  ColorCustomMode,
  ColorRangeType,
  DataZoomRangeType,
  EventType,
  ShelveFieldType,
  ShelveType,
  UIChartDataLabelDisplayType
} from './option/define/common';
import {Field as AbstractField, Field} from '../../../domain/workbook/configurations/field/field';

import * as _ from 'lodash';
import {OptionGenerator} from './option/util/option-generator';
import {Series} from './option/define/series';
import {DataZoomType} from './option/define/datazoom';
import {ColorOptionConverter} from './option/converter/color-option-converter';
import {AxisOptionConverter} from './option/converter/axis-option-converter';
import {LabelOptionConverter} from './option/converter/label-option-converter';
import {FormatOptionConverter} from './option/converter/format-option-converter';
import {CommonOptionConverter} from './option/converter/common-option-converter';
import {ToolOptionConverter} from './option/converter/tool-option-converter';
import {LegendOptionConverter} from './option/converter/legend-option-converter';
import {AnalysisConfig} from '../../../page/component/value/analysis';
import {ColorRange} from './option/ui-option/ui-color';
import {UIChartAxisGrid} from './option/ui-option/ui-axis';
import {TooltipOptionConverter} from './option/converter/tooltip-option-converter';
import {Shelf} from '@domain/workbook/configurations/shelf/shelf';
import {fromEvent} from 'rxjs';
import {debounceTime, map} from 'rxjs/operators';
import {Theme} from '../../value/user.setting.value';
import UI = OptionGenerator.UI;
import {EventBroadcaster} from "@common/event/event.broadcaster";

declare let echarts: any;

export abstract class BaseChart<T extends UIOption> extends AbstractComponent implements OnInit, AfterViewInit, OnDestroy {

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Private Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Protected Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  protected echarts: any = echarts;

  // 차트를 그리기 위한 기반 데이터
  protected data: any;
  protected originalData: any;

  // 선반 정보
  protected pivot: Pivot;

  // map shelf
  protected shelf: Shelf;

  // 기존 선반 정보 (병렬 / 중첩에따라서 변경되지않는 선반값)
  protected originPivot: Pivot;

  // used in selection filter
  protected originShelf: Shelf;

  // 저장 정보
  protected saveInfo: UIOption;

  // 선반을 구성하는 필드 정보
  protected fieldInfo: PivotTableInfo;

  // 선반을 구성하는 필드 정보 (name으로만 설정)
  protected fieldOriginInfo: PivotTableInfo;

  // 데이터를 구성하는 피봇정보
  protected pivotInfo: PivotTableInfo;

  // UI 연동을 위한 추가정보(필터 등등)
  protected params: any;

  // UI 옵션 별 호출하는 함수 관리
  protected convertInfo: object;

  // 차트 데이터 선택 여부
  protected isSelected: boolean;

  // time 필드 존재 여부
  protected existTimeField: boolean;

  // 차트의 마우스 모드
  @Output()
  protected mouseMode: ChartMouseMode = ChartMouseMode.SINGLE;

  // 선택 모드시 브러쉬 형태
  @Output()
  protected brushType: BrushType = BrushType.RECT;

  // 변경된 UI 옵션을 UI로 전송
  @Output()
  protected uiOptionUpdated = new EventEmitter();

  // 차트 선택정보를 UI로 전송
  @Output()
  protected chartSelectInfo = new EventEmitter();

  // 차트 데이터줌 변경정보를 UI로 전송
  @Output()
  protected chartDatazoomInfo = new EventEmitter<any>();

  // No Data
  @Output()
  protected noData = new EventEmitter();

  // 선반 데이터 변경
  @Output()
  protected changePivotData = new EventEmitter<any>();

  // guide 화면으로 표시 (차트 미표시)
  @Output()
  protected showGuide = new EventEmitter();

  // 차트 표시 완료
  @Output()
  protected drawFinished = new EventEmitter();

  protected broadCaster = new EventBroadcaster();

  // 차트 draw를 발생시킨 이벤트 타입
  protected drawByType: EventType;

  // 마지막으로 그려진 시리즈정보
  protected lastDrawSeries: Series[];

  // 위젯에서 draw할경우 추가정보
  protected widgetDrawParam: any;

  // current widget Id
  protected widgetId: string;

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // echart instance
  public chart: any;

  // 외부 UI 에서 관리하는 차트 옵션
  public uiOption: T;

  // E-Chart 내부 옵션
  public chartOption: BaseOption;

  // 기본 미니맵 확대 범위
  public defaultZoomRange: UIChartZoom[];

  // 페이지 / 대쉬보드화면 여부 (default: false 페이지가 아닐때)
  @Input()
  public isPage: boolean = false;

  // 애니메이션 또는 리사이즈시 딜레이가 필요한 경우가 있음
  @Input()
  public resizeDelay: number = 0;

  // 다시그리는 업데이트 여부
  @Input()
  public isUpdateRedraw: boolean = true;

  @Input()
  public userCustomFunction;

  // 고급분석
  public analysis: AnalysisConfig = null;

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Getter & Setter
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // UI Option Setter
  @Input('uiOption')
  set setUIOption(value: T) {

    // Set
    this.uiOption = value;

    // point re-size from map point type
    if (!_.isUndefined(this.uiOption['isChangeStyle']) && this.uiOption['isChangeStyle']) {
      this.draw(false);
      return;
    }

    // 차트변경시 uiOption 이 초기화되므로 uiOption 값 재설정
    this.setDataInfo();

    // 차트 표현
    if (this.chart && this.data) {
      this.draw(true);
    }

    // drawByType 초기화
    this.drawByType = null;
  }

  @Input('resultData')
  set resultData(result: any) {

    ////////////////////////////////////////////////////////
    // Validation
    ////////////////////////////////////////////////////////

    // 데이터가 아예 없는경우 (차트 초기 로딩같은..)
    if (!result || !result.data) {
      return;
    }

    if(result['config'] && result['config']['context']){
      this.widgetId = result['config']['context']['discovery.widget.id'];
    }

    // 데이터 타입이  Object일 경우 => 맵 차트
    if (result.data instanceof Object && result.data.totalFeatures > 0) {

      // Set
      this.originalData = _.cloneDeep(result.data);
      this.data = result.data;
      this.pivot = result.config.pivot;
      this.shelf = result.config.shelf;

      // 데이터레이블에서 사용되는 uiData에 설정된 columns 데이터 설정
      this.data.columns = this.setUIData();
      this.saveInfo = result.uiOption;
      if (result.hasOwnProperty('params')) {
        this.params = result.params; // UI 연동을 위한 추가정보(필터 등등)
      }
      if (result.hasOwnProperty('type')) {
        this.drawByType = result.type; // draw를 발생시킨 타입이 있는경우 설정
      }

      // uiOption값 설정
      this.setDataInfo();

      // 선반정보를 기반으로 차트를 구성하는 필드정보 설정
      this.setFieldInfo();

      // pivot 정보 설정
      // this.setPivotInfo();

      // 차트 표현
      if (this.chart) {
        this.draw();
      }

      // drawByType 초기화
      this.drawByType = null;

      return;

    }

    // 서버 데이터가 비어있을 경우
    if (!(result.data instanceof Array)
      && ((!result.data.columns || !result.data.rows)
        || (result.data.columns.length === 0 && result.data.rows.length === 0))
      && ((!result.data.nodes || !result.data.links)
        || (result.data.nodes.length === 0 && result.data.links.length === 0))) {

      // No Data 이벤트 발생
      this.noData.emit();
      return;
    }
    // 서버 데이터가 비어있을 경우 => 네트워크 차트
    else if (result.data instanceof Array && result.data.length === 0) {
      // No Data 이벤트 발생
      this.noData.emit();
      return;
    }

    ////////////////////////////////////////////////////////
    // Set
    ////////////////////////////////////////////////////////

    // Set
    this.pivot = result.config.pivot;
    this.shelf = result.config.shelf;
    this.originPivot = _.cloneDeep(this.pivot);
    if (!this.originShelf) this.originShelf = _.cloneDeep(this.shelf);
    this.originalData = _.cloneDeep(result.data);
    this.widgetDrawParam = _.cloneDeep(result.params);

    ///////////////////////////
    // 기준선 or Min/Max 변경시
    ///////////////////////////

    // Y축이 Value축인경우
    if (!_.isUndefined(this.uiOption.yAxis)
      && _.eq(this.uiOption.yAxis.label.type, ChartAxisLabelType.VALUE)) {

      // 기준선 변경
      if (!_.isUndefined(this.uiOption.yAxis.baseline)
        && !isNaN(this.uiOption.yAxis.baseline as number)
        && this.uiOption.yAxis.baseline !== 0) {

        this.calculateBaseline(this.uiOption.yAxis.baseline as number, result, true);
      }

      // Min/Max 변경
      if (!_.isUndefined(this.uiOption.yAxis.grid)
        && !this.uiOption.yAxis.grid.autoScaled) {

        this.calculateMinMax(this.uiOption.yAxis.grid, result, true);
      }
    }

    // X축이 Value축인경우
    if (!_.isUndefined(this.uiOption.xAxis)
      && _.eq(this.uiOption.xAxis.label.type, ChartAxisLabelType.VALUE)) {

      // 기준선 변경
      if (!_.isUndefined(this.uiOption.xAxis.baseline)
        && !isNaN(this.uiOption.xAxis.baseline as number)
        && this.uiOption.xAxis.baseline !== 0) {

        this.calculateBaseline(this.uiOption.xAxis.baseline as number, result, false);
      }

      // Min/Max 변경
      if (!_.isUndefined(this.uiOption.xAxis.grid)
        && !this.uiOption.xAxis.grid.autoScaled) {

        this.calculateMinMax(this.uiOption.xAxis.grid, result, false);
      }
    }

    ///////////////////////////
    ///////////////////////////

    // Set
    this.data = result.data;

    // 데이터레이블에서 사용되는 uiData에 설정된 columns 데이터 설정
    this.data.columns = this.setUIData();
    this.saveInfo = result.uiOption;
    if (result.hasOwnProperty('params')) {
      this.params = result.params; // UI 연동을 위한 추가정보(필터 등등)
    }
    if (result.hasOwnProperty('type')) {
      this.drawByType = result.type; // draw를 발생시킨 타입이 있는경우 설정
    }

    // uiOption값 설정
    this.setDataInfo();

    // 선반정보를 기반으로 차트를 구성하는 필드정보 설정
    this.setFieldInfo();

    // pivot 정보 설정
    this.setPivotInfo();

    // 차트 표현
    if (this.chart) {
      this.uiOption = result.uiOption;
      this.draw();
    }

    // drawByType 초기화
    this.drawByType = null;
  }

  protected calculateMinMax(grid: UIChartAxisGrid, result: any, _isYAxis: boolean): void {

    // 축범위 자동설정일 경우
    if (grid.autoScaled) {
      if (result.data.categories && result.data.categories.length > 0) {
        let min = null;
        let max = null;
        _.each(result.data.categories, (category) => {
          _.each(category.value, (value) => {
            if (min === null || value < min) {
              min = value;
            }
            if (max === null || value > max) {
              max = value;
            }
          });
        });
        grid.min = min > 0
          ? Math.ceil(min - ((max - min) * 0.05))
          : min
        grid.max = max;
      } else {
        grid.min = result.data.info.minValue > 0
          ? Math.ceil(result.data.info.minValue - ((result.data.info.maxValue - result.data.info.minValue) * 0.05))
          : result.data.info.minValue
        grid.max = result.data.info.maxValue;
      }
    }

    // Min / Max값이 없다면 수행취소
    if (((_.isUndefined(grid.min) || grid.min === 0)
      && (_.isUndefined(grid.max) || grid.max === 0))) {
      return;
    }

    // 멀티시리즈 개수를 구한다.
    const seriesList = [];
    result.data.columns.map((column, _index) => {
      const nameArr = _.split(column.name, CHART_STRING_DELIMITER);
      let name = '';
      if (nameArr.length > 1) {
        nameArr.map((temp, nameIdx) => {
          if (nameIdx < nameArr.length - 1) {
            if (nameIdx > 0) {
              name += CHART_STRING_DELIMITER;
            }
            name += temp;
          }
        });
      } else {
        name = nameArr[0];
      }

      let isAlready = false;
      seriesList.map((series, _seriesIdx) => {
        if (series === name) {
          isAlready = true;
          return false;
        }
      });

      if (!isAlready) {
        seriesList.push(name);
      }
    });

    // Min/Max 처리
    if (!result.data.categories || result.data.categories.length === 0) {
      result.data.columns.map((column, _colIdx) => {
        column.value.map((value, colValIdx) => {
          if (value < grid.min) {
            column.value[colValIdx] = grid.min;
          } else if (value > grid.max) {
            column.value[colValIdx] = grid.max;
          }
        });
      });
    } else {

      _.each(result.data.categories, (category, _categoryIdx) => {
        const totalValue = [];
        const seriesValue = [];
        result.data.columns.map((column, _colIdx) => {

          if (column.name.indexOf(category.name) === -1) {
            return true;
          }

          column.value.map((value, index) => {
            if (_.isUndefined(totalValue[index]) || isNaN(totalValue[index])) {
              totalValue[index] = 0;
              seriesValue[index] = 0;
            }

            if (totalValue[index] > grid.max) {
              column.value[index] = 0;
            } else if (totalValue[index] + value > grid.max) {
              if (seriesValue[index] <= 0) {
                column.value[index] = grid.max;
              } else {
                column.value[index] = (grid.max as number) - totalValue[index];
              }
            } else if (totalValue[index] + value < grid.min) {
              column.value[index] = 0;
            } else if (totalValue[index] < grid.min && totalValue[index] + value > grid.min) {
              column.value[index] = totalValue[index] + value;
            } else {
              column.value[index] = value;
            }
            seriesValue[index] += column.value[index];
            totalValue[index] += value;
          });
        });

        // Min값보다 작다면
        _.each(totalValue, (value, valueIndex) => {
          if (value < grid.min) {
            result.data.columns.map((column, _colIdx) => {
              column.value.map((_value, colValIdx) => {
                if (colValIdx === valueIndex) {
                  column.value[colValIdx] = 0;
                }
              });
            });
          }
        });
      });
    }
  }

  protected calculateBaseline(baseline: number, result: any, _isYAxis: boolean): void {

    // 멀티시리즈 개수를 구한다.
    const seriesList = [];
    result.data.columns.map((column, _index) => {
      const nameArr = _.split(column.name, CHART_STRING_DELIMITER);
      let name = '';
      if (nameArr.length > 1) {
        nameArr.map((temp, nameIdx) => {
          if (nameIdx < nameArr.length - 1) {
            if (nameIdx > 0) {
              name += CHART_STRING_DELIMITER;
            }
            name += temp;
          }
        });
      } else {
        name = nameArr[0];
      }

      let isAlready = false;
      seriesList.map((series, _seriesIdx) => {
        if (series === name) {
          isAlready = true;
          return false;
        }
      });

      if (!isAlready) {
        seriesList.push(name);
      }
    });

    // Value값을 마이너스 처리
    if (!result.data.categories || result.data.categories.length === 0) {
      result.data.columns.map((column, _colIdx) => {
        column.value.map((value, valIdx) => {
          if (value > 0) {
            column.value[valIdx] = value - baseline;
          } else {
            column.value[valIdx] = (Math.abs(value) + Math.abs(baseline)) * -1;
          }
        });
      });
    } else {
      const categoryVal = [];
      const categoryPer = [];
      for (let num = 0; num < result.data.categories.length; num++) {

        const category = result.data.categories[num];
        for (let num2 = 0; num2 < category.value.length; num2++) {

          const value = category.value[num2];
          const index = (num * category.value.length) + num2;
          const baselineGap = Math.abs(value - baseline);
          const baselinePer = baselineGap / Math.abs(value);
          categoryVal[index] = value;
          categoryPer[index] = baselinePer;
        }
      }

      result.data.columns.map((column, _colIdx) => {
        column.value.map((value, valIdx) => {
          if (categoryVal[valIdx] < baseline) {
            column.value[valIdx] = (Math.abs(value) * categoryPer[valIdx]) * -1;
          } else {
            column.value[valIdx] = Math.abs(value) * categoryPer[valIdx];
          }

        });
      });
    }
  }

  /**
   * uiData에 설정될 columns데이터 설정
   */
  protected setUIData(): any {

    const addAllValues = ((columns: any, type: any): any => {

      const list = [];
      columns.forEach((item) => {
        if (!item[type]) return;
        item[type].forEach((value, index) => {
          // 해당 index에 해당하는값의 총값을 구하기
          list[index] = (!list[index] ? 0 : list[index]) + value;
        })
      });

      return list;
    });
    /*
        _.each(this.data.columns, (data, index) => {
          data.categoryName = _.cloneDeep(this.data.rows); // 해당 dataIndex걸로 넣어주면됨

          data.categoryValue = [];
          data.categoryPercent = [];

          // 해당 dataIndex걸로 넣어주면됨
          // 단일 series인 경우
          if (!this.data.categories || (this.data.categories && this.data.categories.length === 0)) {

            data.categoryValue = addAllValues(_.cloneDeep(this.originalData.columns), 'value');
            data.categoryPercent = addAllValues(_.cloneDeep(this.data.columns), 'percentage');
            data.seriesName = _.cloneDeep(this.data.rows);
            // 멀티 series인 경우
          } else {
            if (this.data.categories) {
              for (const category of this.data.categories) {
                data.categoryValue = _.cloneDeep(category.value);
                data.categoryPercent = _.cloneDeep(category.percentage);
              }
            }

            data.seriesName = _.split(data.name, CHART_STRING_DELIMITER)[0];
          }

          // 해당 dataIndex로 설정
          data.seriesValue = _.cloneDeep(this.originalData.columns[index].value);
          data.seriesPercent = _.cloneDeep(data.percentage);
        });
    */

    // rows 축의 개수만큼 넣어줌
    const copyOfData = JSON.parse(JSON.stringify(this.data));
    const copyOfOriginalData = JSON.parse(JSON.stringify(this.originalData));

    _.each(copyOfData.columns, (data, index) => {
      data.categoryName = copyOfData.rows; // 해당 dataIndex걸로 넣어주면됨

      data.categoryValue = [];
      data.categoryPercent = [];

      // 해당 dataIndex걸로 넣어주면됨
      // 단일 series인 경우
      if (!copyOfData.categories || (copyOfData.categories && copyOfData.categories.length === 0)) {
        data.categoryValue = addAllValues(copyOfOriginalData.columns, 'value');
        data.categoryPercent = addAllValues(copyOfData.columns, 'percentage');
        data.seriesName = copyOfData.rows;
      } else {
        // 멀티 series인 경우
        if (copyOfData.categories) {
          for (const category of copyOfData.categories) {
            data.categoryValue = category.value;
            data.categoryPercent = category.percentage;
          }
        }

        data.seriesName = _.split(data.name, CHART_STRING_DELIMITER)[0];
      }

      // 해당 dataIndex로 설정
      data.seriesValue = copyOfOriginalData.columns[index].value;
      data.seriesPercent = _.cloneDeep(data.percentage);
    });
    this.data = copyOfData;

    return this.data.columns;
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Constructor
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // 생성자
  protected constructor(
    protected elementRef: ElementRef,
    protected injector: Injector) {

    super(elementRef, injector);

    this.broadCaster = injector.get(EventBroadcaster);
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Override Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // Init
  public ngOnInit() {
    super.ngOnInit();

    // Resize
    const resizeEvent$ = fromEvent(window, 'resize')
      .pipe(
        map(() => document.documentElement.clientWidth + 'x' + document.documentElement.clientHeight),
        debounceTime(500)
      );

    const windowResizeSubscribe = resizeEvent$.subscribe(() => {
      try {
        if (this.chart && this.chart.resize) {
          this.chart.resize();
        }
      } catch (error) {
      }
    });

    this.subscriptions.push(windowResizeSubscribe);

    this.subscriptions.push(
      this.broadCaster.on<any>('' +
        'CHANGE_DIMENSION_COLOR').subscribe((data: {widgetId: string, changedMapping: object}) => {
        if(this.widgetId === data.widgetId && this.isPage){ // isPage: true 편집 화면일 경우에만 그래프가 바뀌도록
          const changedMapping = data.changedMapping;
          if(changedMapping){
            this.uiOption.color['mapping'] = changedMapping;
            this.uiOption.color['mappingArray'] = Object.keys( changedMapping ).map( key => {
              return {alias: key, color: changedMapping[key]};
            });
            this.draw(false);
          }
        }

      })
    );
  }

  // Destory
  public ngOnDestroy() {

    // 차트 초기화
    if (this.chart && !this.chart._disposed) {
      if (!_.isUndefined(this.chart.clear)) this.chart.clear();
      if (!_.isUndefined(this.chart.dispose)) this.chart.dispose();
    }

    // Destory
    super.ngOnDestroy();
  }

  public ngAfterViewInit() {
    super.ngAfterViewInit();
    // Chart Instance 생성
    this.chart = this.echarts.init(this.$element.find('.chartCanvas')[0], 'exntu');

    // 초기에 주입된 데이터를 기준으로 차트를 표현한다.
    if (this.data) {
      this.draw();
    }
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  /**
   * 차트 클리어
   */
  public clear(): void {
    ('function' === typeof this.chart.clear) && (this.chart.clear());
  } // function - clear

  /**
   * 차트에 설정된 옵션으로 차트를 그린다.
   * - 각 차트에서 Override
   * @param isKeepRange: 현재 스크롤 위치를 기억해야 할 경우
   * @param changedMapping: 차원 값 그래프의 바뀐 색 데이터
   */
  public draw(isKeepRange?: boolean): void {

    ////////////////////////////////////////////////////////
    // Valid 체크
    ////////////////////////////////////////////////////////

    if (!this.isValid(this.pivot)) {

      // No Data 이벤트 발생
      this.noData.emit();
      return;
    }

    ////////////////////////////////////////////////////////
    // Basic (Type, Title, etc..)
    ////////////////////////////////////////////////////////

    // 차트의 기본옵션을 생성한다.
    this.chartOption = this.initOption();

    // 차트 기본설정 정보를 변환
    this.chartOption = this.convertBasic();

    ////////////////////////////////////////////////////////
    // dataInfo
    // - 시리즈를 구성하는 데이터의 min/max 정보. E-Chart 에서 사용하는 속성 아님
    // - 그 외에도 custom한 정보를 담고 있는 속성
    ////////////////////////////////////////////////////////

    // 차트 커스텀 정보를 변환
    this.chartOption = this.convertDataInfo();

    ////////////////////////////////////////////////////////
    // xAxis
    ////////////////////////////////////////////////////////

    // 차트 X축 정보를 변환
    this.chartOption = this.convertXAxis();

    ////////////////////////////////////////////////////////
    // yAxis
    ////////////////////////////////////////////////////////

    // 차트 Y축 정보를 변환
    this.chartOption = this.convertYAxis();

    ////////////////////////////////////////////////////////
    // series
    ////////////////////////////////////////////////////////

    // 차트 시리즈 정보를 변환
    this.chartOption = this.convertSeries();

    ////////////////////////////////////////////////////////
    // tooltip
    ////////////////////////////////////////////////////////

    // 차트 툴팁 정보를 변환
    this.chartOption = this.convertTooltip();

    ////////////////////////////////////////////////////////
    // dataZoom
    ////////////////////////////////////////////////////////

    // 차트가 데이터줌 정보를 반환
    this.chartOption = this.convertDataZoom(isKeepRange);

    ////////////////////////////////////////////////////////
    // Legend
    ////////////////////////////////////////////////////////

    this.chartOption = this.convertLegend();

    ////////////////////////////////////////////////////////
    // grid
    ////////////////////////////////////////////////////////

    // 차트 그리드(배치) 정보를 반환
    this.chartOption = this.convertGrid();

    ////////////////////////////////////////////////////////
    // 추가적인 옵션사항
    ////////////////////////////////////////////////////////

    this.chartOption = this.convertEtc();

    ////////////////////////////////////////////////////////
    // 셀렉션 필터 유지
    ////////////////////////////////////////////////////////

    this.chartOption = this.convertSelectionData();

    ////////////////////////////////////////////////////////
    // apply
    ////////////////////////////////////////////////////////

    // 차트 반영
    this.apply();

    ////////////////////////////////////////////////////////
    // 현재 설정된 미니맵 저장 -> widget에서 dataZoom 툴바에서 사용됨
    ////////////////////////////////////////////////////////
    this.defaultZoomRange = this.saveDataZoomRange();

    ////////////////////////////////////////////////////////
    // Draw Finish
    // - 차트 표현 완료후 resize등 후속처리
    ////////////////////////////////////////////////////////

    this.drawFinish();

    ////////////////////////////////////////////////////////
    // Selection 이벤트 등록
    ////////////////////////////////////////////////////////

    if (!this.isPage) {
      this.selection();
    }

    ////////////////////////////////////////////////////////
    // Datazoom 이벤트 등록
    ////////////////////////////////////////////////////////

    this.datazoom();
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Protected Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  ////////////////////////////////////////////////////////
  // Basic (Type, Title, etc..)
  ////////////////////////////////////////////////////////

  /**
   * 차트의 기본 옵션을 생성한다.
   * - 반드시 각 차트에서 Override
   */
  protected initOption(): BaseOption {
    throw new Error('initOption is not Override');
  }


  /**
   * 차트 기본설정 정보를 변환한다.
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected convertBasic(): BaseOption {

    ////////////////////////////////////////////////////////
    // 차트별 기본정보 추가사항
    ////////////////////////////////////////////////////////

    // 차트별 추가사항 반영
    this.chartOption = this.additionalBasic();

    // 차트옵션 반환
    return this.chartOption;

  } // protected convertBasic(): BaseOption {

  /**
   * 차트별 기본설정 추가정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected additionalBasic(): BaseOption {
    // 차트옵션 반환
    return this.chartOption;
  }

  ////////////////////////////////////////////////////////
  // xAxis
  ////////////////////////////////////////////////////////

  /**
   * X축 정보를 변환한다.
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected convertXAxis(): BaseOption {

    // 축데이터가 없는경우 return
    if (!this.uiOption.xAxis) return this.chartOption;

    ////////////////////////////////////////////////////////
    // 축관련 기본설정
    ////////////////////////////////////////////////////////

    this.chartOption = AxisOptionConverter.convertAxisDefault(this.chartOption, this.uiOption, AxisType.X);

    ////////////////////////////////////////////////////////
    // 차트 데이터를 기반으로 X축 생성
    ////////////////////////////////////////////////////////

    this.chartOption = this.convertXAxisData();

    ////////////////////////////////////////////////////////
    // 공통 옵션 (세로형/가로형) 적용
    ////////////////////////////////////////////////////////

    this.chartOption = CommonOptionConverter.convertCommonAxis(this.chartOption, this.uiOption, AxisType.X, this.fieldInfo);

    ////////////////////////////////////////////////////////
    // X축 옵션 적용
    ////////////////////////////////////////////////////////

    this.chartOption = AxisOptionConverter.convertAxis(this.chartOption, this.uiOption, AxisType.X, this.data);

    ////////////////////////////////////////////////////////
    // 차트별 X축 추가사항
    ////////////////////////////////////////////////////////

    // 차트별 추가사항 반영
    this.chartOption = this.additionalXAxis();

    // 차트옵션 반환
    return this.chartOption;

  } // protected convertXAxis(): BaseOption {

  /**
   * 차트별 X축 정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected convertXAxisData(): BaseOption {

    ////////////////////////////////////////////////////////
    // 차트 데이터를 기반으로 X축 생성
    ////////////////////////////////////////////////////////

    // X축 명칭
    this.chartOption.xAxis[0].name = this.uiOption.xAxis.customName ? this.uiOption.xAxis.customName : _.join(this.fieldInfo.cols, CHART_STRING_DELIMITER);
    this.chartOption.xAxis[0].axisName = _.join(this.fieldInfo.cols, CHART_STRING_DELIMITER);

    ////////////////////////////////////////////////////////
    // 차트 데이터를 기반으로 X축 데이터 생성
    ////////////////////////////////////////////////////////

    // X축 데이터
    if (_.eq(this.chartOption.xAxis[0].type, AxisType.CATEGORY)) {
      this.chartOption.xAxis[0].data = this.data.rows;
    }

    // 차트옵션 반환
    return this.chartOption;
  }

  /**
   * 차트별 X축 추가정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected additionalXAxis(): BaseOption {
    // 차트옵션 반환
    return this.chartOption;
  }

  ////////////////////////////////////////////////////////
  // yAxis
  ////////////////////////////////////////////////////////

  // /**
  //  * X축 기본 색상등 설정
  //  */
  // protected convertYAxisDefaultSetting() {
  //   // default 축라인색상 설정
  //   if (!this.chartOption.yAxis[0].axisLine.lineStyle) this.chartOption.yAxis[0].axisLine = {lineStyle : {}};
  //
  //   // default 축라인색상 설정
  //   this.chartOption.yAxis[0].axisLine.lineStyle['color'] = AxisDefaultColor.AXIS_LINE_COLOR.toString();
  //   // default 축value 색상설정
  //   this.chartOption.yAxis[0].axisLabel.color = AxisDefaultColor.LABEL_COLOR.toString();
  //   // default 축라벨 색상설정
  //   this.chartOption.yAxis[0].nameTextStyle.color = AxisDefaultColor.LABEL_COLOR.toString();
  //
  //   this.chartOption.yAxis[0].nameTextStyle.padding = [0, 0, 10, 10];
  //
  //   // chartZoom이 1개이면서 세로에 있는경우 또는 chartZoom이 가로 / 세로 둘다 있는경우
  //   if ((this.uiOption.chartZooms.length > 0 && _.find(this.uiOption.chartZooms, {orient: 'HORIZONTAL'})) ||
  //     this.uiOption.chartZooms.length >= 2) {
  //
  //     if (!this.chartOption.yAxis[0].splitLine || !this.chartOption.yAxis[0].splitLine.lineStyle) this.chartOption.yAxis[0].splitLine = {lineStyle : {}};
  //     // default 라인색상 설정
  //     this.chartOption.yAxis[0].splitLine.lineStyle['color'] = AxisDefaultColor.LINE_COLOR.toString();
  //   }
  //
  //   return this.chartOption;
  // }

  /**
   * Y축 정보를 변환한다.
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected convertYAxis(): BaseOption {

    // 축데이터가 없는경우 return
    if (!this.uiOption.yAxis) return this.chartOption;

    ////////////////////////////////////////////////////////
    // 축관련 기본설정
    ////////////////////////////////////////////////////////

    this.chartOption = AxisOptionConverter.convertAxisDefault(this.chartOption, this.uiOption, AxisType.Y);

    ////////////////////////////////////////////////////////
    // 차트 데이터를 기반으로 Y축 생성
    ////////////////////////////////////////////////////////

    this.chartOption = this.convertYAxisData();

    ////////////////////////////////////////////////////////
    // 공통 옵션 (세로형/가로형) 적용
    ////////////////////////////////////////////////////////

    this.chartOption = CommonOptionConverter.convertCommonAxis(this.chartOption, this.uiOption, AxisType.Y, this.fieldInfo);

    ////////////////////////////////////////////////////////
    // Y축 옵션 적용
    ////////////////////////////////////////////////////////

    this.chartOption = AxisOptionConverter.convertAxis(this.chartOption, this.uiOption, AxisType.Y, this.data);

    ////////////////////////////////////////////////////////
    // 차트별 Y축 추가사항
    ////////////////////////////////////////////////////////

    // 차트별 추가사항 반영
    this.chartOption = this.additionalYAxis();

    // 차트옵션 반환
    return this.chartOption;

  } // protected convertXAxis(): BaseOption {

  /**
   * 차트별 Y축 정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected convertYAxisData(): BaseOption {

    ////////////////////////////////////////////////////////
    // 차트 데이터를 기반으로 Y축 생성
    ////////////////////////////////////////////////////////

    // Y축 명칭
    this.chartOption.yAxis[0].name = this.uiOption.yAxis.customName ? this.uiOption.yAxis.customName : _.join(this.fieldInfo.aggs, CHART_STRING_DELIMITER);
    this.chartOption.yAxis[0].axisName = _.join(this.fieldInfo.aggs, CHART_STRING_DELIMITER);

    ////////////////////////////////////////////////////////
    // 차트 데이터를 기반으로 Y축 데이터 생성
    ////////////////////////////////////////////////////////

    // Y축 데이터
    if (!_.eq(this.chartOption.xAxis[0].type, AxisType.CATEGORY)) {
      this.chartOption.yAxis[0].data = this.data.rows;
    }

    // 차트옵션 반환
    return this.chartOption;
  }

  /**
   * 차트별 Y축 추가정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected additionalYAxis(): BaseOption {
    // 차트옵션 반환
    return this.chartOption;
  }

  ////////////////////////////////////////////////////////
  // grid
  ////////////////////////////////////////////////////////

  /**
   * 그리드(배치) 정보를 변환한다.
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected convertGrid(): BaseOption {

    ////////////////////////////////////////////////////////
    // grid 설정
    ////////////////////////////////////////////////////////

    this.chartOption = ToolOptionConverter.convertGrid(this.chartOption, this.uiOption);

    ////////////////////////////////////////////////////////
    // 차트별 grid 추가사항
    ////////////////////////////////////////////////////////

    // 차트별 추가사항 반영
    this.chartOption = this.additionalGrid();

    // 차트옵션 반환
    return this.chartOption;
  }

  /**
   * 차트별 그리드(배치) 추가정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected additionalGrid(): BaseOption {
    // 차트옵션 반환
    return this.chartOption;
  }

  ////////////////////////////////////////////////////////
  // series
  ////////////////////////////////////////////////////////

  /**
   * 시리즈 정보를 변환한다.
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected convertSeries(): BaseOption {

    ////////////////////////////////////////////////////////
    // 차트 데이터를 기반으로 시리즈 생성
    ////////////////////////////////////////////////////////

    // 시리즈 설정
    this.chartOption = this.convertSeriesData();

    ////////////////////////////////////////////////////////
    // 색상옵션 적용
    ////////////////////////////////////////////////////////

    // 색상 설정
    this.chartOption = ColorOptionConverter.convertColor(this.chartOption, this.uiOption, this.fieldOriginInfo, this.fieldInfo, this.pivotInfo, null);

    ////////////////////////////////////////////////////////
    // 숫자 포맷 옵션 적용
    ////////////////////////////////////////////////////////

    this.chartOption = FormatOptionConverter.convertFormatSeries(this.chartOption, this.uiOption, this.pivot);

    ////////////////////////////////////////////////////////
    // 데이터 레이블 옵션 적용
    ////////////////////////////////////////////////////////

    // 레이블 설정
    this.chartOption = LabelOptionConverter.convertLabel(this.chartOption, this.uiOption);

    ////////////////////////////////////////////////////////
    // 공통 옵션 적용
    ////////////////////////////////////////////////////////

    this.chartOption = CommonOptionConverter.convertCommonSeries(this.chartOption, this.uiOption, this.fieldInfo);

    ////////////////////////////////////////////////////////
    // 차트별 추가사항
    ////////////////////////////////////////////////////////

    // 차트별 추가사항 반영
    this.chartOption = this.additionalSeries();

    // 차트옵션 반환
    return this.chartOption;

  } // protected convertSeries(): BaseOption {

  /**
   * 차트별 시리즈 추가정보
   * - 반드시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected convertSeriesData(): BaseOption {
    throw new Error('convertSeriesData is not Override');
  }

  /**
   * 차트별 시리즈 추가정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected additionalSeries(): BaseOption {
    // 차트옵션 반환
    return this.chartOption;
  }

  ////////////////////////////////////////////////////////
  // tooltip
  ////////////////////////////////////////////////////////

  /**
   * 툴팁 정보를 변환한다.
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected convertTooltip(): BaseOption {

    ////////////////////////////////////////////////////////
    // 숫자 포맷 옵션 적용
    ////////////////////////////////////////////////////////

    this.chartOption = FormatOptionConverter.convertFormatTooltip(this.chartOption, this.uiOption, this.fieldOriginInfo, this.pivot);

    ////////////////////////////////////////////////////////
    // 차트별 추가사항
    ////////////////////////////////////////////////////////

    // 차트별 추가사항 반영
    this.chartOption = this.additionalTooltip();

    // 차트옵션 반환
    return this.chartOption;

  } // protected convertSeries(): BaseOption {

  /**
   * 차트별 툴팁 추가정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected additionalTooltip(): BaseOption {
    // 차트옵션 반환
    return this.chartOption;
  }

  ////////////////////////////////////////////////////////
  // dataInfo
  // - 시리즈를 구성하는 데이터의 min/max 정보. E-Chart 에서 사용하는 속성 아님
  // - 그 외에도 custom한 정보를 담고 있는 속성
  ////////////////////////////////////////////////////////

  /**
   * 데이터 정보를 변환한다.
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected convertDataInfo(): BaseOption {

    ////////////////////////////////////////////////////////
    // Min / Max
    ////////////////////////////////////////////////////////

    // min/max 값 설정
    this.chartOption.dataInfo = {
      minValue: this.data.info.minValue,
      maxValue: this.data.info.maxValue
    };

    ////////////////////////////////////////////////////////
    // 차트별 추가사항
    ////////////////////////////////////////////////////////

    // 차트별 추가사항 반영
    this.chartOption = this.additionalDataInfo();

    // 차트옵션 반환
    return this.chartOption;

  } // protected convertDataInfo(): BaseOption {

  /**
   * 차트별 데이터 추가정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected additionalDataInfo(): BaseOption {
    // 차트옵션 반환
    return this.chartOption;
  }

  ////////////////////////////////////////////////////////
  // grid
  ////////////////////////////////////////////////////////

  /**
   * 추가적인 기타 옵션사항 설정
   * @returns {BaseOption}
   */
  protected convertEtc(): BaseOption {

    ////////////////////////////////////////////////////////
    // 폰트사이즈 설정
    ////////////////////////////////////////////////////////

    this.chartOption = CommonOptionConverter.convertCommonFont(this.chartOption, this.uiOption);

    ////////////////////////////////////////////////////////
    // 차트별  추가사항
    ////////////////////////////////////////////////////////

    // 차트별 기타 추가사항 반영
    this.chartOption = this.additionalEtc();

    // 차트옵션 반환
    return this.chartOption;
  }

  /**
   * 차트별 기타 추가정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected additionalEtc(): BaseOption {
    // 차트옵션 반환
    return this.chartOption;
  }

  ////////////////////////////////////////////////////////
  // apply
  ////////////////////////////////////////////////////////

  /**
   * 차트에 옵션 반영
   * - Echart기반 차트가 아닐경우 Override 필요
   * @param initFl 차트 초기화 여부
   */
  protected apply(initFl: boolean = true): void {

    // 초기화를 하는경우
    // externalFilters가 true인 경우 - 다른차트에서 selection필터를 설정시 적용되는 차트를 그리는경우 차트 초기화
    if ((this.isUpdateRedraw && initFl) ||
      (!this.isNullOrUndefined(this.params) && this.params.externalFilters)) {
      // 차트 제거
      this.chart.dispose();

      // Chart Instance 생성
      this.chart = this.echarts.init(this.$element.find('.chartCanvas')[0], 'exntu');
    }

    if (this.chartOption.legend && this.chartOption.legend.textStyle) {
      const isWidget = (0 < this.$element.closest('page-widget').length);
      if (isWidget && $('body').hasClass(Theme.DARK)) {
        this.chartOption.legend.textStyle.color = '#ffffff';
      } else {
        this.chartOption.legend.textStyle.color = '#333';
      }
    }

    if (this.userCustomFunction && '' !== this.userCustomFunction && -1 < this.userCustomFunction.indexOf('main')) {
      const strScript = '(' + this.userCustomFunction + ')';
      // ( new Function( 'return ' + strScript ) )();
      try {
        this.chartOption = eval(strScript)({name: 'InitWidgetEvent', data: this.chartOption});
      } catch (e) {
        console.error(e);
      }
    }

    // Apply!
    // chart.setOption(option, notMerge, lazyUpdate);
    this.chart.setOption(this.chartOption, false, false);
  }

  ////////////////////////////////////////////////////////
  // dataZoom
  ////////////////////////////////////////////////////////

  protected convertDataZoom(isKeepRange?: boolean): BaseOption {

    if (this.uiOption.chartZooms && this.uiOption.chartZooms[0].auto) {
      ////////////////////////////////////////////////////////
      // 데이터줌 설정
      ////////////////////////////////////////////////////////

      // 차트가 이미 그려진 상태 & 현재 스크롤 위치를 기억해야 하는경우
      if (!_.isEmpty(this.chart._chartsViews) && isKeepRange) {
        this.chart.getOption().dataZoom.map((obj, idx) => {
          this.chartOption.dataZoom[idx].start = obj.start;
          this.chartOption.dataZoom[idx].end = obj.end;
          this.chartOption.dataZoom[idx].startValue = obj.startValue;
          this.chartOption.dataZoom[idx].endValue = obj.endValue;
        });
      }

      // dataZoom start / end 설정
      this.chartOption = this.convertDataZoomRange(this.chartOption, this.uiOption);

      ////////////////////////////////////////////////////////
      // 데이터줌 show/hide, 축변환 (가로/세로) 설정
      ////////////////////////////////////////////////////////
      this.chartOption = ToolOptionConverter.convertDataZoom(this.chartOption, this.uiOption);

      ////////////////////////////////////////////////////////
      // 차트별 추가사항
      ////////////////////////////////////////////////////////

      // 차트별 추가사항 반영
      this.chartOption = this.additionalDataZoom();

    } else {
      delete this.chartOption.dataZoom;
      if (this.chartOption.toolbox && this.chartOption.toolbox.feature) {
        delete this.chartOption.toolbox.feature.dataZoom;
      }
    }

    // 차트옵션 반환
    return this.chartOption;
  }

  /**
   * 차트별 줌관련 추가정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected additionalDataZoom(): BaseOption {

    // 저장정보 존재 여부에 따라 미니맵 범위 자동 지정
    if (this.uiOption.chartZooms && _.isUndefined(this.uiOption.chartZooms[0].start)) {
      this.convertDataZoomAutoRange(
        this.chartOption,
        20,
        500,
        10,
        this.existTimeField
      );
    }

    // 차트옵션 반환
    return this.chartOption;
  }

  ////////////////////////////////////////////////////////
  // Legend
  ////////////////////////////////////////////////////////

  protected convertLegend(): BaseOption {

    ////////////////////////////////////////////////////////
    // 범례 설정이 없다면 패스
    ////////////////////////////////////////////////////////

    if (!this.chartOption.legend) {
      return this.chartOption;
    }

    ////////////////////////////////////////////////////////
    // 범례 데이터 설정
    ////////////////////////////////////////////////////////

    // color by series인 경우
    if (this.uiOption.color.type === ChartColorType.SERIES) {

      this.chartOption.legend.data = this.fieldInfo.aggs;

      const schema = (this.uiOption.color as UIChartColorBySeries).schema;
      const colorCodes = _.cloneDeep(ChartColorList[schema]);

      // userCodes가 있는경우 codes대신 userCodes를 설정한다
      if ((this.uiOption.color as UIChartColorBySeries).settingUseFl && (this.uiOption.color as UIChartColorBySeries).mapping) {
        Object.keys((this.uiOption.color as UIChartColorBySeries).mapping).forEach((key, index) => {

          colorCodes[index] = (this.uiOption.color as UIChartColorBySeries).mapping[key];
        });
      }

      this.chartOption.legend.color = colorCodes;

      // color by dimension / value인 경우
    } else {

      // option에 범례가 있는경우
      if (this.chartOption.legend) {

        // 범례 항목을 구성하는 차원값 데이터
        let legendData: string[];
        // 열/행의 선반에서의 필드 인덱스
        let fieldIdx: number;
        // 열/행 여부
        let pivotType: ChartPivotType;

        // 열/행/교차 여부 및 몇번째 필드인지 확인
        _.forEach(this.fieldOriginInfo, (value, key) => {
          if (_.indexOf(value, this.uiOption.color['targetField']) > -1) {
            fieldIdx = _.indexOf(value, this.uiOption.color['targetField']);
            pivotType = _.eq(key, ChartPivotType.COLS) ? ChartPivotType.COLS : _.eq(key, ChartPivotType.ROWS) ? ChartPivotType.ROWS : ChartPivotType.AGGS;
          }
        });
        // 한 선반에 2개이상 올라 갈 경우("-"으로 필드값이 이어진 경우는 필드의 인덱스에 해당하는 값만 추출)
        if (this.fieldInfo[pivotType] && this.fieldInfo[pivotType].length > 1) {
          legendData = this.pivotInfo[pivotType].map((value) => {
            return !_.split(value, CHART_STRING_DELIMITER)[fieldIdx] ? value : _.split(value, CHART_STRING_DELIMITER)[fieldIdx];
          });
          // 중복제거
          legendData = _.uniq(legendData);
        } else {
          legendData = this.pivotInfo[pivotType];
        }

        this.chartOption.legend.data = legendData;
        if(this.isNullOrUndefined(this.chartOption.legend.color)
          || this.chartOption.legend.color.length < this.chartOption.series.length){ // 최종 범례 값이 차트 색보다 많을 경우
          this.chartOption.legend.color = ChartColorList[this.uiOption.color['schema']];

        }

        // 사용자 색상 설정 리스트에 맞춰 범례 값 색 정의
        if(!this.isNullOrUndefined(this.uiOption.color['mappingArray'])
          && this.uiOption.color['mappingArray'].length > 0 && this.uiOption.type=='pie'){
          legendData.forEach((legend, index) => {
            const legendIdx = this.uiOption.color['mappingArray'].findIndex(item => {
              return item['alias'] == legend;
            });
            if(-1 !== legendIdx){
              this.chartOption.legend.color[index] = this.uiOption.color['mappingArray'][legendIdx]['color'];
            }
          });
        }

      }
    }

    ////////////////////////////////////////////////////////
    // 범례 show / hide 설정
    ////////////////////////////////////////////////////////

    this.chartOption = LegendOptionConverter.convertLegend(this.chartOption, this.uiOption);

    ////////////////////////////////////////////////////////
    // 차트별 추가사항
    ////////////////////////////////////////////////////////

    // 차트별 추가사항 반영
    this.chartOption = this.additionalLegend();

    return this.chartOption;
  }

  /**
   * 차트별 범례관련 추가정보
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected additionalLegend(): BaseOption {
    // 차트옵션 반환
    return this.chartOption;
  }

  ////////////////////////////////////////////////////////
  // Draw Finish
  ////////////////////////////////////////////////////////

  /**
   * 차트 표현후 리사이즈
   * - 필요시 각 차트에서 Override
   * @returns {BaseOption}
   */
  protected drawFinish(): void {

    if (0 < this.chartOption.series.length) {

      // if (!_.isUndefined(this.chartOption.brush)) this.convertMouseMode(this.mouseMode, this.brushType);

      // Resize
      if (!_.isUndefined(this.chart)) {
        setTimeout(
          () => {
            if (this.chart) {
              this.chart.resize();
              this.drawFinished.emit();
            }
          }
        );
      }
    } else {
      this.drawFinished.emit();
    }
  }

  ////////////////////////////////////////////////////////
  // Event
  ////////////////////////////////////////////////////////

  /**
   * 셀렉션 이벤트를 등록한다.
   * - 필요시 각 차트에서 Override
   */
  protected selection(): void {
  }

  /**
   * 데이터줌 이벤트를 등록한다.
   * - 필요시 각 차트에서 Override
   */
  protected datazoom(): void {
    this.addChartDatazoomEventListener();
  }

  ////////////////////////////////////////////////////////
  // Support Method
  ////////////////////////////////////////////////////////

  /**
   * 선반정보를 기반으로 차트를 구성하는 필드정보 설정
   *
   */
  protected setFieldInfo(): void {

    const shelve: any = this.pivot;

    // time 필드 존재 여부
    this.existTimeField = false;
    const setFieldName = ((item, shelveFieldType?: ShelveFieldType): string => {

      // shelveFieldType이 있는경우 해당타입일때만 데이터 리턴
      if (!shelveFieldType || (shelveFieldType && item.type === shelveFieldType)) {
        const fieldName = !_.isEmpty(item.alias) ? item.alias : item.name;
        if (_.eq(item.type, ShelveFieldType.TIMESTAMP)) this.existTimeField = true;
        return fieldName;
      }
    });

    // name으로만 fieldName설정
    const setOriginFieldName = ((item, shelveFieldType?: ShelveFieldType): string => {

      // shelveFieldType이 있는경우 해당타입일때만 데이터 리턴
      if (!shelveFieldType || (shelveFieldType && item.type === shelveFieldType)) {
        if (_.eq(item.type, ShelveFieldType.TIMESTAMP)) this.existTimeField = true;
        return item.name;
      }
    });

    // 열, 행, 교차 선반의 필드명 설정
    const cols: string[] = shelve.columns.map((column) => {
      return setFieldName(column);
    });
    const rows: string[] = shelve.rows.map((row) => {
      return setFieldName(row);
    });
    const aggs = shelve.aggregations.map((aggregation) => {
      return setFieldName(aggregation, ShelveFieldType.MEASURE);
    }).filter((item) => {
      return typeof item !== 'undefined'
    });

    this.fieldInfo = new PivotTableInfo(cols, rows, aggs);

    // 열, 행, 교차 선반의 필드명 설정
    const originCols: string[] = shelve.columns.map((column) => {
      return setOriginFieldName(column);
    });
    const originRows: string[] = shelve.rows.map((row) => {
      return setOriginFieldName(row);
    });
    const originAggs = shelve.aggregations.map((aggregation) => {
      return setOriginFieldName(aggregation);
    }).filter((item) => {
      return typeof item !== 'undefined'
    });

    // name으로만 항상 넣는 fieldInfo
    this.fieldOriginInfo = new PivotTableInfo(originCols, originRows, originAggs);
  }

  /**
   * 결과데이터를 기반으로 차트를 구성하는 피봇정보 설정
   * - 필요시 각 차트에서 Override
   */
  protected setPivotInfo(): void {

    // Pivot 정보 조합
    const cols: string[] = this.data.rows;
    const rows: string[] = [];

    // data columns 값이 있는경우
    if (this.data.columns) {

      this.data.columns.map((column, _index) => {
        const seriesName: string = column.name;
        // const measureName = _.last(_.split(seriesName, CHART_STRING_DELIMITER));
        // pivot rows 설정
        const rowNameList = _.split(seriesName, CHART_STRING_DELIMITER);
        if (rowNameList.length > 1) {
          // 측정값 이름은 제외
          rows.push(_.join(_.dropRight(rowNameList), CHART_STRING_DELIMITER));
        }
      });
    }

    // Pivot 정보 생성
    this.pivotInfo = new PivotTableInfo(cols, rows, this.fieldInfo.aggs);
  }

  /**
   * 해당 선반의 특정필드타입의 개수
   */
  protected getFieldTypeCount(pivot: Pivot, shelveType: ShelveType, fieldType: ShelveFieldType) {

    return pivot[shelveType].filter((field) => {

      // dimension인 timestamp 데이터일때 type을 timestamp로 타입값 수정
      if (ShelveFieldType.DIMENSION === field.type && field.format && field.format.unit) field.type = ShelveFieldType.TIMESTAMP;

      return _.eq(field.type, fieldType);
    }).length;

  }

  /**
   * 차트가 그려진 후 UI에 필요한 옵션 설정 - 차원값 리스트
   *
   */
  protected setDimensionList(): T {

    const shelve: any = this.pivot;

    if (shelve) {
      // 선반값에서 해당 타입에 해당하는값만 name string값으로 리턴
      const getShelveReturnString = ((shelveInfo: any, typeList: ShelveFieldType[]): string[] => {
        const resultList: string[] = [];
        _.forEach(shelveInfo, (_value, key) => {
          shelveInfo[key].map((item) => {
            if (_.eq(item.type, typeList[0]) || _.eq(item.type, typeList[1])) {
              resultList.push(item.name);
            }
          });
        });
        return resultList;
      });

      // 색상지정 기준 필드리스트 설정, 기본 필드 설정
      this.uiOption.fieldList = getShelveReturnString(shelve, [ShelveFieldType.DIMENSION, ShelveFieldType.TIMESTAMP]);

      if (this.uiOption.color) {
        // targetField 설정
        const targetField = (this.uiOption.color as UIChartColorByDimension).targetField;

        // targetField가 있을때
        if (!_.isEmpty(targetField)) {
          if (this.uiOption.fieldList.indexOf(targetField) < 0) (this.uiOption.color as UIChartColorByDimension).targetField = _.last(this.uiOption.fieldList);

          // targetField가 없을때
        } else {

          // 마지막 필드를 타겟필드로 잡기
          (this.uiOption.color as UIChartColorByDimension).targetField = _.last(this.uiOption.fieldList);
        }
      }
    }

    return this.uiOption;
  }

  /**
   * 차트가 그려진 후 UI에 필요한 옵션 설정 - 측정값 리스트
   *
   */
  protected setMeasureList(): T {

    const shelve: any = this.pivot;

    // 선반값에서 해당 타입에 해당하는값만 field값으로 리턴
    const getShelveReturnField = ((shelveInfo: any, typeList: ShelveFieldType[]): AbstractField[] => {
      const resultList: AbstractField[] = [];
      _.forEach(shelveInfo, (_value, key) => {
        shelveInfo[key].map((item) => {
          if ((_.eq(item.type, typeList[0]) || _.eq(item.type, typeList[1])) && (item.field && ('user_expr' === item.field.type || item.field.logicalType && -1 === item.field.logicalType.indexOf('GEO')))) {
            resultList.push(item);
          }
        });
      });
      return resultList;
    });
    // 색상지정 기준 필드리스트 설정(measure list)
    this.uiOption.fieldMeasureList = getShelveReturnField(shelve, [ShelveFieldType.MEASURE, ShelveFieldType.CALCULATED]);
    // 색상지정 기준 필드리스트 설정(dimension list)
    this.uiOption.fielDimensionList = getShelveReturnField(shelve, [ShelveFieldType.DIMENSION, ShelveFieldType.TIMESTAMP]);

    return this.uiOption;
  }

  /**
   * 차트가 그려진 후 UI에 필요한 옵션 설정 - 축 정보
   *
   */
  protected setAxisNameInfo(setNameFl: boolean = true): void {

    const xAxis = _.cloneDeep(_.compact(_.concat(this.uiOption.xAxis, this.uiOption.yAxis, this.uiOption.secondaryAxis)).filter((item) => {
      return _.eq(item.mode, AxisLabelType.ROW) || _.eq(item.mode, AxisLabelType.SUBROW);
    }));
    const yAxis = _.cloneDeep(_.compact(_.concat(this.uiOption.xAxis, this.uiOption.yAxis, this.uiOption.secondaryAxis)).filter((item) => {
      return _.eq(item.mode, AxisLabelType.COLUMN) || _.eq(item.mode, AxisLabelType.SUBCOLUMN);
    }));

    // 설정여부가 true인 경우에만 설정
    if (setNameFl) {
      this.chartOption.xAxis.map((axis, idx) => {
        xAxis[idx].name = axis.axisName;
        // xAxis[idx].defaultName = axis.axisName;
      });

      this.chartOption.yAxis.map((axis, idx) => {
        yAxis[idx].name = axis.axisName;
        // yAxis[idx].defaultName = axis.axisName;
      });
    }
  }

  /**
   * 차트가 그려진 후 UI에 필요한 옵션 설정 - 데이터
   *
   */
  protected setDataInfo(): void {

    if (this.uiOption && this.data && this.data.info) {
      this.uiOption.maxValue = this.data.info.maxValue;
      this.uiOption.minValue = this.data.info.minValue;
    }

    // TODO 축설정 변경하면서 주석처리 차후에 처리할것
    // if (this.uiOption.label) {
    //   // minValue가 0보다 작은경우 scaleDisabled true
    //   if (this.data.info.minValue < 0) {
    //     this.uiOption.label.scaleDisabled = true;
    //
    //     // 0이거나 0보다 큰경우
    //   } else {
    //
    //     this.uiOption.label.scaleDisabled = false;
    //   }
    // }

    if (!this.uiOption) return;

    // dataLabel, toolTip 병렬 / 중첩에 따라 설정
    this.uiOption = this.setDataLabel();

    // color by dimension시 사용되는 필드정보 설정
    this.uiOption = this.setDimensionList();

    // 색상지정 기준 필드리스트 설정(measure list)
    this.uiOption = this.setMeasureList();

    /*
        // color by measure일때 eventType이 있는경우 (min / max가 바뀌는경우) 색상 설정값 초기화
        if (!_.isEmpty(this.drawByType) && this.uiOption.color && ChartColorType.MEASURE === this.uiOption.color.type) {
          delete (<UIChartColorByValue>this.uiOption.color).ranges;
          delete (<UIChartColorGradationByValue>this.uiOption.color).visualGradations;
          delete (<UIChartColorByValue>this.uiOption.color).customMode;

          const colorList = ChartColorList[this.uiOption.color['schema']];

          // ranges가 초기화
          this.uiOption.color['ranges'] = ColorOptionConverter.setMeasureColorRange(this.uiOption, this.data, colorList);
        }
    */

    if (!_.isEmpty(this.drawByType) && this.uiOption.color && (this.uiOption.color as UIChartColorByValue).customMode) {
      let colorList = [];
      const colrObj: UIChartColorByValue = this.uiOption.color as UIChartColorByValue;
      switch (colrObj.customMode) {
        case ColorCustomMode.SECTION:
          colorList = colrObj.ranges.map(item => item.color).reverse();
          this.uiOption.color['ranges'] = ColorOptionConverter.setMeasureColorRange(this.uiOption, this.data, colorList);
          break;
        case ColorCustomMode.GRADIENT :
          const prevMaxVal: number = colrObj.ranges[colrObj.ranges.length - 1]['value'];
          const currMaxVal: number = this.uiOption.maxValue;
          const resetRange: (item: ColorRange) => ColorRange = (item) => {
            if (item['value']) {
              if (item['value'] < prevMaxVal) {
                item['value'] = Math.round(currMaxVal * (item['value'] / prevMaxVal));
              } else {
                item['value'] = currMaxVal;
              }
            }
            return item;
          };
          this.uiOption.color['ranges'] = colrObj['ranges'].map(item => resetRange(item));
          this.uiOption.color['visualGradations'] = colrObj['visualGradations'].map(item => resetRange(item));
          break;
        default:
          // ranges 초기화
          delete (this.uiOption.color as UIChartColorByValue).ranges;
          delete (this.uiOption.color as UIChartColorGradationByValue).visualGradations;
          delete (this.uiOption.color as UIChartColorByValue).customMode;
          colorList = ChartColorList[this.uiOption.color['schema']];
          this.uiOption.color['ranges'] = ColorOptionConverter.setMeasureColorRange(this.uiOption, this.data, colorList);
      }
    }

    // color mapping값 설정 - S
    // 이전값 임시 저장
    let prevMappingList: { alias: string, color: string }[] = [];
    if (this.uiOption.color && this.uiOption.color && this.uiOption.color['mappingArray']) {
      prevMappingList = this.uiOption.color['mappingArray'];
    }
    // 매핑값 초기화
    this.uiOption.color = this.setMapping();
    // 이전값 재적용
    if (0 < prevMappingList.length) {
      const currColorMapObj = this.uiOption.color['mapping'];
      const currColorMapList = this.uiOption.color['mappingArray'];
      prevMappingList.forEach(prev => {
        currColorMapList.some(curr => {
          if (curr.alias === prev.alias) {
            curr.color = prev.color;
            return true;
          }
          return false;
        });
        (currColorMapObj[prev.alias]) && (currColorMapObj[prev.alias] = prev.color);
      });
    }
    // color mapping값 설정 - E
  }

  /**
   * 차트 선택효과 전체 해제
   *
   * @param option
   * @returns {BaseOption}
   */
  protected selectionClear(option: BaseOption): BaseOption {

    const series = option.series;

    this.pivot.columns.forEach((item) => {
      delete item['data'];
    });

    this.pivot.aggregations.forEach((item) => {
      delete item['data'];
    });

    series.forEach((obj) => {
      obj.data.forEach(item => {
        this.clearSelectSeriesData(item);
      });
    });
    return option;
  }

  /**
   * 시리즈 데이터 선택 - 차트별 재설정
   * @param seriesData
   */
  protected selectSeriesData(seriesData) {
    if (seriesData.itemStyle) {
      seriesData.itemStyle.normal.opacity = 1;
      seriesData.selected = true;
    }
  } // function - selectSeriesData

  /**
   * 시리즈 데이터 선택 해제 - 차트별 재설정
   * @param seriesData
   */
  protected unselectSeriesData(seriesData) {
    if (seriesData.itemStyle) {
      seriesData.itemStyle.normal.opacity = 0.2;
      seriesData.selected = false;
    }
  } // function - unselectSeriesData

  /**
   * 전체 선택 해제 처리 - 차트별 재설정
   * @param seriesData
   */
  protected clearSelectSeriesData(seriesData) {
    if (seriesData.itemStyle) {
      seriesData.itemStyle.normal.opacity = 1;
      seriesData.selected = false;
    }
  } // function - clearSelectSeriesData

  /**
   * 차트 선택 효과 설정(단일/리스트)
   *
   * @param option
   * @param targetData
   * @param {boolean} isMulti
   * @returns {BaseOption}
   */
  protected selectionAdd(option: BaseOption, targetData: any, isMulti: boolean = false): BaseOption {

    // 현재 차트 시리즈 리스트
    const series = option.series;

    const selectSameSeries: (data) => void = (seriesData) => {
      series.forEach(seriesItem => {
        seriesItem.data.some(dataItem => {
          if (dataItem.name === seriesData.name) {
            this.selectSeriesData(dataItem);
            return true;
          }
          return false;
        });
      });
    };
    const unselectSameSeries: (data) => void = (seriesData) => {
      series.forEach(seriesItem => {
        seriesItem.data.some(dataItem => {
          if (dataItem.name === seriesData.name) {
            this.unselectSeriesData(dataItem);
            return true;
          }
          return false;
        });
      });
    };

    // 단일/리스트 선택에 따라 처리
    if (isMulti) {
      let selectedIndexs: number[] = targetData.reduce((acc, val) => acc.concat(val.dataIndex), []);
      selectedIndexs = _.uniq(selectedIndexs);
      series[0].data.forEach((dataItem, idx) => {
        if (-1 < selectedIndexs.indexOf(idx)) {
          // 선택된 경우
          selectSameSeries(dataItem);
        } else {
          unselectSameSeries(dataItem);
        }
      });
    } else {
      // 이미 선택된 다른 데이터가 없다면 모든 데이터 dimmed 처리
      series.forEach((sObj) => {
        sObj.data.forEach(item => {
          if (isMulti || !item.selected) {
            unselectSameSeries(item);
          }
        });
      });

      // 선택한 데이터
      selectSameSeries(targetData);
    }
    return option;
  }

  /**
   * 차트 선택 해제
   *
   * @param option
   * @param targetData
   * @returns {BaseOption}
   */
  protected selectionSubstract(option: BaseOption, targetData: any): BaseOption {

    // 현재 차트 시리즈 리스트
    const series = option.series;

    // 선택한 데이터
    const unselectSameSeries: (data) => void = (seriesData) => {
      series.forEach(seriesItem => {
        seriesItem.data.some(dataItem => {
          if (dataItem.name === seriesData.name) {
            this.unselectSeriesData(dataItem);
            return true;
          }
          return false;
        });
      });
    };
    unselectSameSeries(targetData);

    // 모든 항목이 선택 해제 되었는지 확인한다.
    let isSelected: boolean = false;
    series.some(sItem => {
      if (sItem.data.some(dItem => dItem.selected)) {
        isSelected = true;
        return;
      } else {
        return false;
      }
    });
    if (!isSelected) {
      option = this.selectionClear(option);
    }

    return option;
  }

  /**
   * 차트 선택 데이터 설정
   *
   * @param params
   * @param colValues
   * @param rowValues
   */
  protected setSelectData(params: any, colValues: string[], rowValues: string[]): any {

    const returnDataList: any = [];

    // 선택정보 설정
    let targetValues: string[] = [];
    _.forEach(this.pivot, (_value, key) => {

      // deep copy
      let deepCopyShelve = _.cloneDeep(this.pivot[key]);

      // dimension timestamp 데이터만 설정
      deepCopyShelve = _.filter(deepCopyShelve, (obj) => {
        if (_.eq(obj.type, ShelveFieldType.DIMENSION) || _.eq(obj.type, ShelveFieldType.TIMESTAMP)) {
          return obj;
        }
      });

      deepCopyShelve.map((obj, idx) => {
        // 선택한 데이터 정보가 있을 경우에만 차원값필드와 맵핑
        if (!_.isNull(params)) {

          targetValues = _.eq(key, ShelveType.ROWS) ? rowValues : colValues;
        }
        // 해당 차원값에 선택 데이터 값을 맵핑, null값인경우 데이터가 들어가지 않게 설정
        if (!_.isEmpty(targetValues) && targetValues[idx]) {

          // object 형식으로 returnData 설정
          if (-1 === _.findIndex(returnDataList, {name: obj.name})) {

            returnDataList.push(obj);
          }
          returnDataList[returnDataList.length - 1].data = [targetValues[idx]];

        }
      });
    });

    return returnDataList;
  }

  /**
   * color의 mapping, mappingArray값 설정
   */
  protected setMapping(): UIChartColor {
    if (!this.uiOption.color || (ChartColorType.SERIES !== this.uiOption.color.type && ChartColorType.DIMENSION !== this.uiOption.color.type)
      || !this.uiOption.fieldMeasureList || this.uiOption.fieldMeasureList.length === 0) return this.uiOption.color;

    // mapping값이 없거나, 선반값이 변경된경우 mapping값 초기화
    if (!(this.uiOption.color as UIChartColorBySeries).mapping || EventType.CHANGE_PIVOT === this.drawByType) {
      (this.uiOption.color as UIChartColorBySeries).mapping = {};
    }

    // color mapping값 설정
    if ((this.uiOption.color as UIChartColorBySeries).schema) {

      // mapping값이 제거된경우 이후 색상값을 초기화
      let colorChangedFl: boolean = false;

      // dimension 인 경우 fieldMeasureList 로부터 mapping 값을 가져오지 않으니 제외
      if(ChartColorType.DIMENSION != this.uiOption.color.type){
        // fieldMeasureList에서 제거된 값 제거
        for (const key in (this.uiOption.color as UIChartColorBySeries).mapping) {
          if (key) {
            const index = _.findIndex(this.uiOption.fieldMeasureList, {alias: key});

            // fieldMeasureList에서 없는 리스트이거나 이전의 값이 제거된경우 색상 초기화를 위해 제거
            if (-1 === index || colorChangedFl) {
              delete (this.uiOption.color as UIChartColorBySeries).mapping[key];
              colorChangedFl = true;
            }
          }
        }
      }

      if(ChartColorType.SERIES == this.uiOption.color.type){
        this.uiOption.fieldMeasureList.forEach((item, index) => {
          // 해당 alias 값이 없을 때에만 기본 색상 설정
          if ((this.uiOption.color as UIChartColorBySeries).schema && !(this.uiOption.color as UIChartColorBySeries).mapping[item.alias]) {
            (this.uiOption.color as UIChartColorBySeries).mapping[item.alias] = ChartColorList[(this.uiOption.color as UIChartColorBySeries).schema][index];
          }
        });
      }

      // mapping map array 로 변경
      (this.uiOption.color as UIChartColorBySeries).mappingArray = [];

      Object.keys((this.uiOption.color as UIChartColorBySeries).mapping).forEach((key) => {

        (this.uiOption.color as UIChartColorBySeries).mappingArray.push({
          alias: key,
          color: (this.uiOption.color as UIChartColorBySeries).mapping[key]
        });
      });
    }
    return this.uiOption.color;
  }

  /**
   * color by measure의 range값 리턴
   * @returns {ColorRange[]}
   */
  protected setMeasureColorRange(schema): ColorRange[] {

    // 리턴값
    const rangeList = [];

    // 해당 schema에 해당하는 색상 리스트 설정
    const colorList = ChartColorList[schema];

    let rowsListLength = this.data.rows.length;

    // 차트타입에 따라서 range리스트 계산하는 rows리스트의 값을 다르게 설정
    switch (this.uiOption.type) {

      // 그리드차트의경우 행 / 열의 length를 합하여 비교
      case ChartType.GRID:
        let gridRowsListLength = 0;
        // rows가 빈값이 아닌경우
        if (this.data.rows.length > 0 && !_.isEmpty(this.data.rows[0])) {

          gridRowsListLength += this.data.rows.length;
        }

        // columns가 빈값이 아닌경우
        if (this.data.columns.length > 0 && -1 !== this.data.columns[0].name.indexOf(CHART_STRING_DELIMITER)) {

          gridRowsListLength += this.data.columns.length;

          // chart_string_delimiter 데이터가 없는경우 => original일때
        } else {
          gridRowsListLength += this.data.columns[0].value.length;
        }

        rowsListLength = gridRowsListLength;
        break;

      // pie, wordcloud 경우 columns의 value length로 설정
      case ChartType.PIE:
      case ChartType.WORDCLOUD:
        rowsListLength = this.data.columns[0].value.length;
        break;
      case ChartType.HEATMAP:
        rowsListLength = this.data.columns.length;
        break;
      case ChartType.TREEMAP:
        rowsListLength = colorList.length;
        break;
    }

    // data.rows length가 colorList보다 작은경우 범위설정을 5개대신 rows개수로 설정
    const colorListLength = colorList.length > rowsListLength ? rowsListLength - 1 : colorList.length - 1;

    // 차이값 설정
    const addValue = (this.uiOption.maxValue - this.uiOption.minValue) / colorListLength;

    let maxValue = _.cloneDeep(this.uiOption.maxValue);

    let shape;
    // if ((<UIScatterChart>this.uiOption).pointShape) {
    //   shape = (<UIScatterChart>this.uiOption).pointShape.toString().toLowerCase();
    // }
    if (this.uiOption['pointShape']) {
      shape = this.uiOption['pointShape'].toString().toLowerCase();
    }

    // set ranges
    for (let index = colorListLength; index >= 0; index--) {

      const color = colorList[index];

      // set the biggest value in min(gt)
      if (colorListLength === index) {

        rangeList.push(UI.Range.colorRange(ColorRangeType.SECTION, color, parseFloat(maxValue.toFixed(1)), null, parseFloat(maxValue.toFixed(1)), null, shape));

      } else {
        // if it's the last value, set null in min(gt)
        let min = 0 === index ? null : parseFloat((maxValue - addValue).toFixed(1));

        // if value if lower than minValue, set it as minValue
        if (min < this.uiOption.minValue && min < 0) min = _.cloneDeep(parseInt(this.uiOption.minValue.toFixed(1), 10));

        rangeList.push(UI.Range.colorRange(ColorRangeType.SECTION, color, min, parseFloat(maxValue.toFixed(1)), min, parseFloat(maxValue.toFixed(1)), shape));

        maxValue = min;
      }
    }

    return rangeList;
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Export Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 선반정보를 기반으로 차트를 그릴수 있는지 여부를 체크
   * - 반드시 각 차트에서 Override
   */
  public isValid(_pivot: Pivot, _shelf?: Shelf): boolean {
    throw new Error('isValid is not Override');
  }

  /**
   * 차트 저장시 현재 미니맵 위치 정보
   */
  public saveDataZoomRange(): UIChartZoom[] {
    const resultList: UIChartZoom[] = [];
    if (!this.chart) {
      return;
    }
    if (!_.isEmpty(this.chart._chartsViews)) {
      this.chart.getOption().dataZoom.map((obj, _idx) => {
        if (_.eq(obj.type, DataZoomType.SLIDER)) {
          resultList.push({
            auto: obj.show,
            start: obj.start,
            end: obj.end,
            startValue: obj.startValue,
            endValue: obj.endValue,
            orient: obj.orient.toUpperCase()
          });
        }
      });
    }

    return resultList;
  }


  /**
   * 마우스 모드 및 멀티선택 모드시 브러쉬 형태 설정
   *
   * @param {ChartMouseMode} type
   * @param {BrushType} brushType
   */
  public convertMouseMode(type: ChartMouseMode, brushType?: BrushType): void {
    this.mouseMode = type;
    let start;
    let end;
    switch (type) {
      case ChartMouseMode.SINGLE :
        this.chart.unsetBrush();
        this.chart.unsetMultipleBrush();
        break;
      case ChartMouseMode.MULTI :
        this.brushType = brushType;
        this.chart.setBrush(brushType);
        this.chart.setMultipleBrush();
        break;
      case ChartMouseMode.DRAGZOOMIN :
        this.chart.toggleSelectZoom();
        break;
      case ChartMouseMode.ZOOMIN :
        this.chart.getOption().dataZoom.map((dataZoom, idx) => {
          if (_.eq(dataZoom.type, DataZoomType.SLIDER)) {
            start = dataZoom.start + 10;
            start = start > 50 ? 50 : start;
            end = dataZoom.end - 10;
            end = end < 50 ? 50 : end;
            this.chart.dispatchAction({
              start,
              end,
              type: 'dataZoom',
              dataZoomIndex: idx
            });
          }
        });
        break;
      case ChartMouseMode.ZOOMOUT :
        this.chart.getOption().dataZoom.map((dataZoom, idx) => {
          if (_.eq(dataZoom.type, DataZoomType.SLIDER)) {
            start = dataZoom.start - 10;
            start = start < 0 ? 0 : start;
            end = dataZoom.end + 10;
            end = end > 100 ? 100 : end;
            this.chart.dispatchAction({
              start,
              end,
              type: 'dataZoom',
              dataZoomIndex: idx
            });
          }
        });
        break;
      case ChartMouseMode.REVERT :
        const defaultZooms = this.defaultZoomRange;
        this.chart.getOption().dataZoom.map((dataZoom, idx) => {
          if (_.eq(dataZoom.type, DataZoomType.SLIDER)) {
            start = defaultZooms[idx].start || 0;
            end = defaultZooms[idx].end || 100;
            this.chart.dispatchAction({
              start,
              end,
              type: 'dataZoom',
              dataZoomIndex: idx,
            });
          }
        });
        break;
      default:
        console.log(type);
    }
    this.mouseMode = type;
  }

  /**
   * Chart Datazoom Event Listener
   */
  public addChartDatazoomEventListener(): void {

    // this.chart.off('datazoom');
    // this.chart.on('datazoom', (params) => {
    //   this.chartDatazoomInfo.emit(params);
    // });
  }

  /**
   * Chart Select(Click) Event Listener
   */
  public addChartSelectEventListener(): void {
    this.chart.off('click');
    this.chart.on('click', (params) => {

      if (params && 'series' !== params.componentType) {
        return;
      }

      if (this.userCustomFunction && '' !== this.userCustomFunction && -1 < this.userCustomFunction.indexOf('main')) {
        const strScript = '(' + this.userCustomFunction + ')';
        // ( new Function( 'return ' + strScript ) )();
        try {
          if (eval(strScript)({name: 'SelectionEvent', data: params ? params.name : ''})) {
            return;
          }
        } catch (e) {
          console.error(e);
        }
      }

      let selectMode: ChartSelectMode;
      let selectedColValues: string[];
      let selectedRowValues: string[];

      // 현재 차트의 시리즈
      const series = this.chartOption.series;
      // 데이터가 아닌 빈 공백을 클릭했다면
      // 모든 데이터 선택효과를 해제하며 필터에서 제거.
      if (_.isNull(params)) {
        selectMode = ChartSelectMode.CLEAR;
        this.chartOption = this.selectionClear(this.chartOption);
        // return;
      } else if (params != null) {

        if (ChartType.WATERFALL === this.uiOption.type && params && params.seriesIndex === 0) {
          return;
        }

        // 대상 데이터
        const targetData = series[params.seriesIndex].data[params.dataIndex];
        // 이미 선택이 되어있는지 여부
        const isSelected = targetData.selected;

        if (isSelected) {
          // 선택 해제
          selectMode = ChartSelectMode.SUBTRACT;
          this.chartOption = this.selectionSubstract(this.chartOption, targetData);
        } else {
          // 선택 처리
          selectMode = ChartSelectMode.ADD;
          this.chartOption = this.selectionAdd(this.chartOption, targetData, false);
        }

        // UI에 전송할 선택정보 설정 - Heatmap/Gauge 별도 구현
        switch (this.uiOption.type) {
          case ChartType.BOXPLOT :
            selectedColValues = _.split(params.name, CHART_STRING_DELIMITER);
            selectedRowValues = [];
            break;
          case ChartType.GAUGE :
            selectedRowValues = [_.split(params.data.name, CHART_STRING_DELIMITER)[1]];
            selectedColValues = selectedRowValues ? [] : null;
            break;
          case ChartType.HEATMAP :
            selectedColValues = [_.split(params.data.name, CHART_STRING_DELIMITER)[0]];
            selectedRowValues = [_.split(params.data.name, CHART_STRING_DELIMITER)[1]];
            break;
          default :
            selectedColValues = _.split(params.name, CHART_STRING_DELIMITER);
            selectedRowValues = _.dropRight(_.split(params.seriesName, CHART_STRING_DELIMITER));
            break;
        }
      } else {
        return;
      }

      // 자기자신을 선택시 externalFilters는 false로 설정
      if (this.params.externalFilters) this.params.externalFilters = false;

      // UI에 전송할 선택정보 설정
      const selectData = this.setSelectData(params, selectedColValues, selectedRowValues);

      // 차트에 적용
      this.apply(false);
      this.lastDrawSeries = _.cloneDeep(this.chartOption['series']);

      // 이벤트 데이터 전송
      this.params['selectType'] = 'SINGLE';
      this.chartSelectInfo.emit(new ChartSelectInfo(selectMode, selectData, this.params));
    });
  } // function - addChartSelectEventListener

  /**
   * Chart Multi Select Event Listener
   *
   */
  public addChartMultiSelectEventListener(): void {
    this.chart.off('brushDragEnd');
    this.chart.on('brushDragEnd', (params) => {

      let selectDataList = [];

      const selectedBrushData: any = params.brushSelectData[0].selected;

      // 선택된값이 없는경우
      if (!selectedBrushData.some(item => item.dataIndex && 0 < item.dataIndex.length)) {
        // 브러쉬 영역 삭제
        this.chart.clearBrush();
        return;
      }

      // 브러쉬 영역 삭제
      this.chart.clearBrush();

      // 선택효과 처리
      this.chartOption = this.selectionAdd(this.chartOption, selectedBrushData, true);

      // 열 선반 데이터 요소
      const cols = this.pivotInfo.cols;
      // 행 선반 데이터 요소
      const rows = this.pivotInfo.rows;
      // 교차선반 데이터 요소 ( scatter )
      const aggs = this.pivotInfo.aggs;

      const setData = ((colIdxList, fields: Field[], shelveData: string[], dataAlter?: Field[], shelveAlterData?: string[]) => {

        const returnList = [];

        colIdxList.forEach((colIdx) => {
          const dataName = !_.isEmpty(shelveData) ? shelveData[colIdx] : shelveAlterData[colIdx];
          _.split(dataName, CHART_STRING_DELIMITER).map((name, idx) => {

            // filter관련 데이터 변경
            const fieldItem = !_.isEmpty(fields) ? fields[idx] : dataAlter[idx];

            // selectDataList에 해당 name의 값이 없을때 selectDataList에 추가
            if (-1 === returnList.findIndex(obj => obj.name === fieldItem.name)) {
              const resultItem = _.cloneDeep(fieldItem);
              resultItem['data'] = [];
              returnList.push(resultItem);
            }

            // 기존데이터에 신규데이터 추가
            returnList[idx].data = _.union(returnList[idx].data, [name]);
          });
        });

        return returnList;
      });

      // UI에 전송할 선택정보 설정
      selectedBrushData.forEach((selected) => {
        // 해당 시리즈의 선택한 데이터 인덱스 모음
        const colIdxList = selected.dataIndex;

        if (colIdxList && colIdxList.length > 0) {
          selectDataList = _.union(selectDataList, setData(colIdxList, this.pivot.columns, cols, this.pivot.aggregations, aggs));
          // 행값이 있을때에만 실행
          if (this.pivot.rows && this.pivot.rows.length > 0) {
            selectDataList = _.union(selectDataList, setData([selected.seriesIndex], this.pivot.rows, rows));
          }
        }
      });

      // 자기자신을 선택시 externalFilters는 false로 설정
      if (this.params.externalFilters) this.params.externalFilters = false;

      // 차트에 적용
      this.apply(false);
      this.lastDrawSeries = _.cloneDeep(this.chartOption['series']);

      // 이벤트 데이터 전송
      this.params['selectType'] = 'MULTI';
      this.chartSelectInfo.emit(new ChartSelectInfo(ChartSelectMode.ADD, selectDataList, this.params));
    });
  }

  /**
   * Chart Legend Select Event Listener
   *
   */
  public addLegendSelectEventListener(): void {
    this.chart.off('legendselectchanged');
    this.chart.on('legendselectchanged', (params) => {
      // 시리즈와 연동없이 구성된 범레 일때만 처리
      if (!this.chartOption.legend.seriesSync) {
        // series 데이터
        const series = this.chartOption.series;

        // 선택한 범례항목 정보
        const selectedName = params.name;
        const isSelected = params.selected[selectedName];

        // 열/행의 선반에서의 필드 인덱스
        let fieldIdx: number;
        // 열/행/교차 여부
        let pivotType: any;


        if (_.eq(this.uiOption.color.type, ChartColorType.DIMENSION)) {
          const targetField = (this.uiOption.color as UIChartColorByDimension).targetField;
          // 열/행/교차 여부 및 몇번째 필드인지 확인
          _.forEach(this.fieldOriginInfo, (value, key) => {
            if (_.indexOf(value, targetField) > -1) {
              fieldIdx = _.indexOf(value, targetField);
              pivotType = _.eq(key, ChartPivotType.COLS) ? ChartPivotType.COLS : _.eq(key, ChartPivotType.ROWS) ? ChartPivotType.ROWS : ChartPivotType.AGGS;
            }
          });
        } else if (_.eq(this.uiOption.color.type, ChartColorType.SERIES)) {
          // color by measure 일때
          pivotType = ChartPivotType.AGGS;
        }

        // series 를 돌면서 각 시리즈 데이터의 내용을 수정
        // show : 해당 범례에 해당하는 데이터를 원래 값으로 처리
        // hide : 해당 범례에 해당하는 데이터를 null처리
        // color by dimension 일때
        series.map((obj) => {
          obj.data.map((valueData, idx) => {
            // 선택한 범례와 동일한지 비교할 데이터의 이름
            let compareName;

            // 예외 처리가 필요한 차트는 개별로직으로 처리
            if (_.eq(pivotType, ChartPivotType.COLS)) {
              // 가로모드일 경우 axis data는 y축이기 때문에 가로/세로 모드 확인
              compareName = !_.isUndefined(this.chartOption.xAxis[0].data) ? this.chartOption.xAxis[0].data[idx] : this.chartOption.yAxis[0].data[idx];
            } else {
              compareName = obj.name;
            }
            if (_.eq(pivotType, ChartPivotType.AGGS)) {
              fieldIdx = _.findLastIndex(compareName.split(CHART_STRING_DELIMITER));
            }
            compareName = _.split(compareName, CHART_STRING_DELIMITER)[fieldIdx];

            if (_.eq(compareName, selectedName)) {
              if (_.isObject(valueData)) {
                const originValue = _.isUndefined(obj.originData[idx].value) ? obj.originData[idx] : obj.originData[idx].value;
                obj.data[idx].value = isSelected ? originValue : null;
              } else {
                obj.data[idx] = isSelected ? obj.originData[idx] : null;
              }
            }
          });
          return obj;
        });

        // 차트에 적용
        this.apply(false);
      }
    });
  }

  /**
   * DataZoom(미니맵) 활성화 영역 범위 변경
   * @param option
   * @param type
   * @param start
   * @param end
   * @param idx
   * @returns {BaseOption}
   */
  protected convertDataZoomRangeByType(option: BaseOption, type: DataZoomRangeType, start: number, end: number, idx?: number): BaseOption {

    if (_.isUndefined(option.dataZoom)) return option;

    // 변경하려는 DataZoom index - 따로 지정하지 않으면 0으로 설정
    const dataZoomIdx = _.isUndefined(idx) ? 0 : idx;

    if (_.eq(type, DataZoomRangeType.COUNT)) {
      option.dataZoom[dataZoomIdx].startValue = start;
      option.dataZoom[dataZoomIdx].endValue = end;
      delete option.dataZoom[dataZoomIdx].start;
      delete option.dataZoom[dataZoomIdx].end;
    } else {
      option.dataZoom[dataZoomIdx].start = start;
      option.dataZoom[dataZoomIdx].end = end;
      delete option.dataZoom[dataZoomIdx].startValue;
      delete option.dataZoom[dataZoomIdx].endValue;
    }

    return option;
  }

  /**
   * dataZoom 범위 start / end 값 설정
   * @param option
   * @param uiOption
   * @returns {BaseOption}
   */
  protected convertDataZoomRange(option: BaseOption, uiOption: UIOption): BaseOption {

    const chartZooms = uiOption.chartZooms;

    if (_.isUndefined(chartZooms)) return this.chartOption;

    chartZooms.forEach((zoom, idx) => {
      if (!_.isUndefined(zoom.start) && !_.isUndefined(zoom.end)) {

        option = this.convertDataZoomRangeByType(option, DataZoomRangeType.PERCENT, zoom.start, zoom.end, idx);
      }
    });

    return option;
  }

  /**
   * DataZoom(미니맵) 활성화 범위 영역 자동 변경
   * @param option
   * @param count
   * @param limit
   * @param percent
   * @param isTime
   * @param idx
   * @returns {BaseOption}
   */
  protected convertDataZoomAutoRange(option: BaseOption, count: number, limit: number, percent: number, isTime: boolean, idx?: number): BaseOption {

    if (_.isUndefined(option.dataZoom)) return option;

    // 시리즈
    const series = option.series;
    // 변경하려는 DataZoom index - 따로 지정하지 않으면 0으로 설정
    const dataZoomIdx = _.isUndefined(idx) ? 0 : idx;
    // 축 단위 개수
    const colCount = !_.isUndefined(option.xAxis[0].data) ? option.xAxis[0].data.length : option.yAxis[0].data.length;

    // 종료지정 설정 (상위 n개)
    let startValue = 0;
    let endValue = count - 1;
    // const isStackMode = _.eq(series[0].type, SeriesType.BAR) && !_.isUndefined(series[0].stack);
    const seriesLength = series.length;

    // 기준 개수가 넘어갈 경우 경우는 n% 로 범위 변경
    if (_.gt(colCount, limit)) {
      // 전체 데이터의 10%인덱스
      endValue = seriesLength >= 20 ? 0 : Math.floor((colCount) * (percent / 100)) - 1;
    }

    // x축 개수에 따라 종료지점 설정
    endValue = _.eq(colCount, 1) ? 0 : _.eq(endValue, 0) ? 1 : endValue;

    // 시간 축이 존재한다면 확대범위를 마지막 축 기준으로 설정
    if (isTime) {
      startValue = colCount - _.cloneDeep(endValue);
      endValue = colCount - 1;
    }

    option.dataZoom[dataZoomIdx].startValue = startValue;
    option.dataZoom[dataZoomIdx].endValue = endValue;
    delete option.dataZoom[dataZoomIdx].start;
    delete option.dataZoom[dataZoomIdx].end;

    // inside datazoom 이 존재한다면 range값 동기화
    option.dataZoom.map((obj) => {
      if (_.eq(obj.type, DataZoomType.INSIDE)) {
        obj.startValue = startValue;
        obj.endValue = endValue;
        delete obj.start;
        delete obj.end;
      }
    });

    return option;
  }

  /**
   * dataLabel, tooltip 중첩에 따라서 설정
   * - 필요시 각 차트에서 Override
   */
  protected setDataLabel(): T {
    return this.uiOption;
  }

  /**
   * 현재 차트가 필터를 발생시켰고, 이전 시리즈정보가 있을경우 select 상태 유지
   */
  protected convertSelectionData(): BaseOption {

    if (this.widgetDrawParam
      && this.widgetDrawParam.selectFilterListList
      && this.widgetDrawParam.selectFilterListList.length > 0) {

      _.each(this.chartOption.series, (series) => {
        _.each(this.lastDrawSeries, (lastDrawSeries) => {
          if (_.eq(series.name, lastDrawSeries.name)) {
            series.itemStyle = lastDrawSeries.itemStyle;
            series.lineStyle = lastDrawSeries.lineStyle;
            series.textStyle = lastDrawSeries.textStyle;
            series.areaStyle = lastDrawSeries.areaStyle;
            series.existSelectData = lastDrawSeries.existSelectData;
            _.each(series.data, (seriesData, index) => {
              const lastSeriesData = lastDrawSeries.data[index];
              if (lastSeriesData && isNaN(lastSeriesData)) {
                if (seriesData && isNaN(seriesData)) {
                  seriesData.itemStyle = lastSeriesData.itemStyle;
                  seriesData.lineStyle = lastSeriesData.lineStyle;
                  seriesData.textStyle = lastSeriesData.textStyle;
                  seriesData.areaStyle = lastSeriesData.areaStyle;
                } else {
                  lastSeriesData.value = seriesData;
                  seriesData = lastSeriesData;
                }
                series.data[index] = seriesData;
              }
            });
          }
        });
      });
    }

    return this.chartOption;
  }

  /**
   * set datalabel when chart has axis
   * @param {Pivot} _prevPivot
   * @param checkChangeSeries
   * @returns {UIOption}
   */
  protected setAxisDataLabel(_prevPivot: Pivot, checkChangeSeries: boolean): T {

    if (!this.pivot || !this.pivot.aggregations || !this.pivot.rows) return this.uiOption;

    // 시리즈관련 리스트 제거
    const spliceSeriesTypeList = ((seriesTypeList, dataLabel: any): any => {

      // displayTypes를 찾는 index
      let index: number;
      for (const item of seriesTypeList) {
        index = dataLabel.displayTypes.indexOf(item);

        if (-1 !== index) {
          // 라벨에서 제거
          dataLabel.displayTypes[index] = null;
        }
      }
      return dataLabel.displayTypes;
    });

    const setDefaultDisplayTypes = ((value): any => {

      if (!value || !value.displayTypes) return [];

      let defaultDisplayTypes = [];

      // when it has single series
      if (this.pivot.aggregations.length <= 1 && this.pivot.rows.length < 1) {

        // set disabled list when it has single series
        const disabledList = [UIChartDataLabelDisplayType.SERIES_NAME, UIChartDataLabelDisplayType.SERIES_VALUE, UIChartDataLabelDisplayType.SERIES_PERCENT];

        // remove disabled list
        defaultDisplayTypes = spliceSeriesTypeList(disabledList, value);

        // set default datalabel, tooltip list
        defaultDisplayTypes[0] = UIChartDataLabelDisplayType.CATEGORY_NAME;
        defaultDisplayTypes[1] = UIChartDataLabelDisplayType.CATEGORY_VALUE;
        // when it has multi series
      } else {

        // set disabled list when it has multi series
        const disabledList = [UIChartDataLabelDisplayType.CATEGORY_VALUE, UIChartDataLabelDisplayType.CATEGORY_PERCENT];

        // remove disabled list
        defaultDisplayTypes = spliceSeriesTypeList(disabledList, value);

        // set default datalabel, tooltip list
        defaultDisplayTypes[3] = UIChartDataLabelDisplayType.SERIES_NAME;
        defaultDisplayTypes[4] = UIChartDataLabelDisplayType.SERIES_VALUE;
      }

      return defaultDisplayTypes;
    });

    // when draw chart or change single <=> multi series
    if ((EventType.CHANGE_PIVOT === this.drawByType && checkChangeSeries) || EventType.CHART_TYPE === this.drawByType) {

      // set datalabel display types
      const datalabelDisplayTypes = setDefaultDisplayTypes(this.uiOption.dataLabel);

      // set tooltip display types
      const tooltipDisplayTypes = setDefaultDisplayTypes(this.uiOption.toolTip);

      // set default datalabel value
      if (this.uiOption.dataLabel && this.uiOption.dataLabel.displayTypes) {
        // set dataLabel
        this.uiOption.dataLabel.displayTypes = datalabelDisplayTypes;
        // set previewList
        this.uiOption.dataLabel.previewList = LabelOptionConverter.setDataLabelPreviewList(this.uiOption);
      }

      // set default tooltip value
      if (this.uiOption.toolTip && this.uiOption.toolTip.displayTypes) {
        // set dataLabel
        this.uiOption.toolTip.displayTypes = tooltipDisplayTypes;
        // set previewList
        this.uiOption.toolTip.previewList = TooltipOptionConverter.setTooltipPreviewList(this.uiOption);
      }
    }

    return this.uiOption;
  }
}


/**
 * 차트 선반/데이터를 기반의 필드, 피봇정보
 */
export class PivotTableInfo {

  public cols: string[];

  public rows: string[];

  public aggs: string[];

  constructor(cols: string[], rows: string[], aggs: string[]) {
    this.cols = cols;
    this.rows = rows;
    this.aggs = aggs;
  }

}


/**
 * 차트 Selection 정보
 */
export class ChartSelectInfo {

  public mode: ChartSelectMode;

  public data: any;

  public params: any;

  constructor(mode: ChartSelectMode, data: any, params?: any) {
    this.mode = mode;
    this.data = data;
    this.params = params;
  }
}
