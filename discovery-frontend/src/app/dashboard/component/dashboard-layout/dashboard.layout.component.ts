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

import * as $ from 'jquery';
import * as _ from 'lodash';
import {isNullOrUndefined, isUndefined} from 'util';

import {
  ApplicationRef,
  ComponentFactoryResolver,
  ComponentRef,
  ElementRef,
  HostListener,
  Injector,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';

import {PopupService} from '@common/service/popup.service';
import {EventBroadcaster} from '@common/event/event.broadcaster';
import {CommonConstant} from '@common/constant/common.constant';
import {ChartType} from '@common/component/chart/option/define/common';

import {Widget} from '@domain/dashboard/widget/widget';
import {
  BoardConfiguration,
  BoardDataSource,
  BoardDataSourceRelation,
  Dashboard,
  DashboardLayout, DashboardWidgetRelation,
  JoinMapping, LayoutContent,
  LayoutMode,
  LayoutWidgetInfo
} from '@domain/dashboard/dashboard';
import {
  ConnectionType,
  Datasource,
  Field,
  FieldNameAlias,
  FieldRole,
  FieldValueAlias,
  LogicalType
} from '@domain/datasource/datasource';
import {PageWidget, PageWidgetConfiguration} from '@domain/dashboard/widget/page-widget';
import {
  BoardGlobalOptions,
  BoardLayoutOptions,
  BoardLayoutType,
  BoardWidgetOptions,
  WidgetShowType
} from '@domain/dashboard/dashboard.globalOptions';
import {Filter} from '@domain/workbook/configurations/filter/filter';
import {TimeFilter} from '@domain/workbook/configurations/filter/time-filter';
import {IntervalFilter} from '@domain/workbook/configurations/filter/interval-filter';
import {CustomField} from '@domain/workbook/configurations/field/custom-field';
import {TimeUnit} from '@domain/workbook/configurations/field/timestamp-field';
import {TimeRangeFilter} from '@domain/workbook/configurations/filter/time-range-filter';
import {FilterWidget, FilterWidgetConfiguration} from '@domain/dashboard/widget/filter-widget';
import {FilterUtil} from '../../util/filter.util';
import {DashboardUtil} from '../../util/dashboard.util';
import {WidgetService} from '../../service/widget.service';
import {DatasourceService} from '../../../datasource/service/datasource.service';
import {AbstractDashboardComponent} from '../../abstract.dashboard.component';
import {DashboardWidgetComponent} from './dashboard.widget.component';
import {DashboardWidgetHeaderComponent} from './dashboard.widget.header.component';
import {TimeDateFilter} from '@domain/workbook/configurations/filter/time-date-filter';

declare let GoldenLayout: any;
declare let async;

export abstract class DashboardLayoutComponent extends AbstractDashboardComponent implements OnInit, OnDestroy {

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | ViewChild Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  @ViewChild('layoutContainer')
  public layoutContainer: ElementRef;

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Private Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  private _isCompleteLayoutLoad: boolean = false;      // Layout 시스템 초기화 완료 여부 ( 위젯 불러오기 포함 )

  private _layoutObj: any;   // 골든 레이아웃

  private _$layoutContainer: any;   // 컨테이너 jQuery element

  private _layoutMode: LayoutMode = LayoutMode.VIEW;

  private _widgetHeaderComps: ComponentRef<DashboardWidgetHeaderComponent>[] = [];  // 위젯 헤더 컴포넌트 목록
  private _widgetComps: ComponentRef<DashboardWidgetComponent>[] = [];              // 위젯 컴포넌트 목록

  private _invalidLayoutWidgets: string[] = [];    // 유효하지 않은 Layout 위젯의 레이아웃 아이디 목록

  protected _removeDsEngineNames: string[] = [];    // List of data source engine names to be deleted

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Variables
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  public dashboard: Dashboard;

  public boardUtil = DashboardUtil;
  public filterUtil = FilterUtil;

  // 대시보드 로딩 표시 여부
  public isShowDashboardLoading: boolean = false;

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Constructor
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  // 생성자
  protected constructor(protected broadCaster: EventBroadcaster,
                        protected widgetService: WidgetService,
                        protected datasourceService: DatasourceService,
                        protected popupService: PopupService,
                        protected appRef: ApplicationRef,
                        protected componentFactoryResolver: ComponentFactoryResolver,
                        protected elementRef: ElementRef,
                        protected injector: Injector) {
    super(elementRef, injector);
  }

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Override Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 클래스 초기화
   */
  public ngOnInit() {
    super.ngOnInit();

    // 위젯 실행
    this.subscriptions.push(
      this.broadCaster.on<any>('START_PROCESS').subscribe((data: { widgetId: string }) => {
        DashboardUtil.getLayoutWidgetInfos(this.dashboard).some(item => {
          if (item.ref === data.widgetId) {
            item.isLoaded = false;
          }
          return (item.ref === data.widgetId);
        });
        this.showBoardLoading();
      })
    );

    // 위젯 종료
    this.subscriptions.push(
      this.broadCaster.on<any>('STOP_PROCESS').subscribe((data: { widgetId: string }) => {
        const layoutWidgets: LayoutWidgetInfo[] = DashboardUtil.getLayoutWidgetInfos(this.dashboard);
        let cntInLayout: number = 0;
        let cntLoaded: number = 0;
        layoutWidgets.forEach(item => {
          if (item.isInLayout) {
            cntInLayout = cntInLayout + 1;
            (item.ref === data.widgetId) && (item.isLoaded = true);
            (item.isLoaded) && (cntLoaded = cntLoaded + 1);
          }
        });
        if (cntInLayout === cntLoaded) {
          this._updateLayoutFinished();
        }
      })
    );

    // 최소/최대 표시 변경
    this.subscriptions.push(
      this.broadCaster.on<any>('TOGGLE_SIZE').subscribe(data => {
        this._getLayoutCompContainerByWidgetId(data.widgetId).parent.toggleMaximise();
      })
    );

    this._initConf();
  } // function - ngOnInit

  /**
   * 클래스 제거
   */
  public ngOnDestroy() {
    super.ngOnDestroy();
    this.destroyDashboard();
  } // function - ngOnDestroy

  @HostListener('window:resize')
  public onResize() {
    this.updateLayoutSize();
  } // function - onResize

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Private Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 특정 위젯 헤더 컴포넌트를 반환한다.
   * @param {string} widgetId
   */
  private _getWidgetHeaderComp(widgetId: string) {
    const widgetHeaderComps = this._widgetHeaderComps.map(item => item.instance).filter(item => item.widget.id === widgetId);
    return (widgetHeaderComps && 0 < widgetHeaderComps.length) ? widgetHeaderComps[0] : null;
  } // function - _getWidgetHeaderComp

  /**
   * 위젯 정보를 바탕으로 Layout Component 의 설정 정보를 얻음
   * @param {Widget} widget
   * @return any
   * @private
   */
  private _getLayoutComponentConfByWidget(widget: Widget) {
    if( widget ) {
      const info: LayoutWidgetInfo = DashboardUtil.getLayoutWidgetInfoByWidgetId(this.dashboard, widget.id);
      if( info ) {
        return {
          id: info.id,
          title: widget.name,
          type: 'component',
          componentName: 'widget',
          componentState: {
            id: info.id,
            type: info.type,
            imageUrl: (widget['imageUrl']) ? '/api/images/load/url?url=' + widget['imageUrl'] : ''
          }
        };
      }
    }
  } // function - _getLayoutComponentConfByWidget

  /**
   * 설정 초기화
   */
  private _initConf() {

    // initialize dashboard - destroy prev dashboard
    this.destroyDashboard();

    // 컴포넌트 목록 및 주요 데이터 초기화
    this._widgetComps = [];
    this._isCompleteLayoutLoad = false;
  } // function - _initConf

  /**
   * 위젯에 대한 ComponentRef를 얻는다.
   * @param {string} widgetId
   * @returns {ComponentRef<DashboardWidgetComponent>}
   */
  private _getWidgetComponentRef(widgetId: string): ComponentRef<DashboardWidgetComponent> {
    return this._widgetComps.filter(item => (item.instance.getWidgetId() === widgetId))[0];
  } // function - _getWidgetComponentRef

  /**
   * 위젯 컴포넌트를 삭제한다.
   * @param {string} widgetId
   */
  public removeWidgetComponent(widgetId: string) {
    this.dashboard = DashboardUtil.setUseWidgetInLayout(this.dashboard, widgetId, false);

    const widgetComponent = this._getWidgetComponentRef(widgetId);
    const widgetHeaderComp = this._getWidgetHeaderComp(widgetId);
    if (widgetComponent) {
      widgetComponent.destroy();
      (widgetHeaderComp) && (widgetHeaderComp.ngOnDestroy());
      this._getLayoutCompContainerByWidgetId(widgetId).remove();
    }
    this._widgetComps = this._widgetComps.filter(item => item.instance.getWidgetId() !== widgetId);
  } // function - removeWidgetComponent

  /**
   * 레이아웃 업데이트 완료
   * @private
   */
  private _updateLayoutFinished() {
    if (!this._isCompleteLayoutLoad) {
      this._isCompleteLayoutLoad = true;
      this.updateLayoutSize();
      this.onLayoutInitialised();
    }
    this.hideBoardLoading();
  } // function - updateLayoutFinished

  /**
   * 강제로 레이아웃을 설정한다.
   * @private
   */
  private _setForceLayout() {
    const board: Dashboard = this.dashboard;

    // 레이아웃 크기 설정
    this._$layoutContainer
      .width(board.configuration.layout.dimensions.width)
      .height(board.configuration.layout.dimensions.height);

    // 레이아웃 업데이트
    this.initLayout(board, this._layoutMode);
    this.renderLayout();
  } // function - _setForceLayout

  /**
   * 대시보드 내 데이터소스 설정 추가
   * @param {Dashboard} boardInfo
   * @returns {[Dashboard , Datasource]}
   * @private
   */
  private _setDatasourceForDashboard(boardInfo: Dashboard): [Dashboard, Datasource] {
    const masterDsInfo: Datasource = null;

    const dashboardConf: BoardConfiguration = boardInfo.configuration;
    const boardDs: BoardDataSource = (dashboardConf && dashboardConf.dataSource) ? dashboardConf.dataSource : undefined;

    // 데이터 소스가 있으면
    if (boardInfo.hasOwnProperty('dataSources') && boardInfo.dataSources.length > 0 && boardDs) {

      const nameAliasList: FieldNameAlias[] = boardInfo.aliases.filter(alias => alias['nameAlias']) as FieldNameAlias[];
      const valueAliasList: FieldValueAlias[] = boardInfo.aliases.filter(alias => alias['valueAlias']) as FieldValueAlias[];

      let summary: { reorderDsList: Datasource[], totalFields: Field[] };
      if ('multi' === boardDs.type) {
        summary = boardDs.dataSources.reduce((acc, currVal) => {
          const singleSummary: { reorderDsList: Datasource[], totalFields: Field[] }
            = this._setSingleDataSource(currVal, boardInfo, nameAliasList, valueAliasList);
          acc.reorderDsList = acc.reorderDsList.concat(singleSummary.reorderDsList);
          acc.totalFields = acc.totalFields.concat(singleSummary.totalFields);
          return acc;
        }, {reorderDsList: [], totalFields: []});
      } else {
        summary = this._setSingleDataSource(boardDs, boardInfo, nameAliasList, valueAliasList);
      }

      boardInfo.dataSources = summary.reorderDsList;  // 순서 재정렬
      dashboardConf.fields = summary.totalFields;     // 전체 필드 정보 등록
    }

    boardInfo.configuration = dashboardConf;

    return [boardInfo, masterDsInfo];
  } // function - _setDatasourceForDashboard

  /**
   * 단일 데이터소스에 대한 설정
   * @param {BoardDataSource} dataSource
   * @param {Dashboard} boardInfo
   * @param {FieldNameAlias[]} nameAliasList
   * @param {FieldValueAlias[]} valueAliasList
   * @returns {{reorderDsList:Datasource[] , totalFields:Field[]}}
   * @private
   */
  private _setSingleDataSource(dataSource: BoardDataSource, boardInfo: Dashboard,
                               nameAliasList: FieldNameAlias[], valueAliasList: FieldValueAlias[]): { reorderDsList: Datasource[], totalFields: Field[] } {

    let totalFields: Field[] = [];          // 전체 필드 목록
    const reorderDsList: Datasource[] = [];   // 마스터 데이터소스 설정 및 데이터소스 정렬 - Master Datasource

    const masterDsInfo: Datasource = DashboardUtil.getDataSourceFromBoardDataSource(boardInfo, dataSource);

    if (isNullOrUndefined(masterDsInfo)) {
      return {reorderDsList: [], totalFields: []};
    }

    // 설정에 있는 Datasource Mapping 정보에 connType, engineName 추가해줌 - MasterDatasource
    dataSource.name = masterDsInfo.name;
    if (ConnectionType.ENGINE === masterDsInfo.connType) {
      dataSource
        = _.merge(dataSource, {
        connType: masterDsInfo.connType,
        engineName: masterDsInfo.engineName
      });
    } else if (ConnectionType.LINK === masterDsInfo.connType) {
      dataSource
        = _.merge(dataSource, {
        connType: dataSource.metaDataSource.connType,
        engineName: dataSource.metaDataSource.engineName
      });
    }
    reorderDsList.push(masterDsInfo); // 정렬 등록
    // 마스터 데이터소스 필드 등록 - Start
    const masterFields: Field[] = masterDsInfo.fields.map((fieldItem: Field) => {
      return this._setFieldAttribute(fieldItem, masterDsInfo, masterDsInfo, boardInfo, nameAliasList, valueAliasList);
    });
    if (dataSource.joins && 0 < dataSource.joins.length) {
      // Join Datasource
      masterDsInfo.fields.forEach((fieldItem: Field) => fieldItem.ref = masterDsInfo.engineName);
    }
    totalFields = totalFields.concat(masterFields);
    // 마스터 데이터소스 필드 등록 - End

    // 제외 필드 선정 && 데이터소스 정렬 && 전체 필드 등록
    const objJoinValueKey: any = {};
    if (dataSource.joins && 0 < dataSource.joins.length) {
      dataSource.joins.forEach((joinItem: JoinMapping) => {
        // 1-Depth Datasource - Start
        {
          const oneDepthDsInfo: Datasource = boardInfo.dataSources.find(dsItem => dsItem.id === joinItem.id);
          // 설정에 있는 Datasource Mapping 정보에 engineName 추가해줌 - OneDepthDatasource
          joinItem = _.merge(joinItem, {engineName: oneDepthDsInfo.engineName});
          // 데이터소스 정렬
          reorderDsList.push(oneDepthDsInfo);
          // 제외 필드 선정
          objJoinValueKey[joinItem.id] =
            Object.keys(joinItem.keyPair).map((keyItem: string) => joinItem.keyPair[keyItem]);
          // 필드 목록 등록
          totalFields = totalFields.concat(oneDepthDsInfo.fields.map(fieldItem => {
            if (fieldItem.role !== FieldRole.TIMESTAMP && fieldItem.name !== 'count'
              && -1 === objJoinValueKey[joinItem.id].indexOf(fieldItem.name)) {
              fieldItem = this._setFieldAttribute(fieldItem, masterDsInfo, oneDepthDsInfo);
              fieldItem.ref = joinItem.engineName;
              return fieldItem;
            } else {
              return null;
            }
          }).filter(fieldItem => fieldItem !== null));
        }
        // 1-Depth Datasource - End
        // 2-Depth Datasource - Start
        if (joinItem.join) {
          const twoDepthDsInfo: Datasource = boardInfo.dataSources.find(dsItem => dsItem.id === joinItem.join.id);
          // 설정에 있는 Datasource Mapping 정보에 engineName 추가해줌 - TwoDepthDatasource
          joinItem.join = _.merge(joinItem.join, {engineName: twoDepthDsInfo.engineName});
          // 데이터소스 정렬
          reorderDsList.push(twoDepthDsInfo);
          // 제외 필드 선정
          objJoinValueKey[joinItem.join.id] =
            Object.keys(joinItem.join.keyPair).map((keyItem: string) => joinItem.join.keyPair[keyItem]);
          // 필드 목록 등록
          totalFields = totalFields.concat(twoDepthDsInfo.fields.map(fieldItem => {
            if (fieldItem.role !== FieldRole.TIMESTAMP && fieldItem.name !== 'count'
              && -1 === objJoinValueKey[joinItem.join.id].indexOf(fieldItem.name)) {
              fieldItem = this._setFieldAttribute(fieldItem, masterDsInfo, twoDepthDsInfo);
              fieldItem.ref = joinItem.joinAlias + '.' + joinItem.join.engineName;
              return fieldItem;
            } else {
              return null;
            }
          }).filter(fieldItem => fieldItem !== null));
        }
        // 2-Depth Datasource - End
      });
    }

    // 태호과장 요청으로 datasource type 설정 추가
    const joins = dataSource.joins;
    if (joins && joins.length > 0) {
      dataSource.type = 'mapping';
    }

    return {
      reorderDsList: reorderDsList,
      totalFields: totalFields
    };
  } // function - _setSingleDataSource

  /**
   * 필드 속성 정의
   * - Join 데이터소스내 필드는 Alias를 설정할 수 없으므로, 그 경우에는 boardInfo 및 Alias 정보를 설정해주지 않는다.
   * @param {Field} fieldItem
   * @param {Datasource} masterDsInfo
   * @param {Datasource} dsInfo
   * @param {Dashboard} boardInfo
   * @param {FieldNameAlias[]} nameAliasList
   * @param {FieldValueAlias[]} valueAliasList
   * @return {Field}
   * @private
   */
  private _setFieldAttribute(fieldItem: Field, masterDsInfo: Datasource, dsInfo: Datasource,
                             boardInfo?: Dashboard, nameAliasList?: FieldNameAlias[], valueAliasList?: FieldValueAlias[]): Field {
    fieldItem.granularity = dsInfo.granularity ? dsInfo.granularity : dsInfo.segGranularity;
    fieldItem.segGranularity = dsInfo.segGranularity ? dsInfo.segGranularity : dsInfo.granularity;
    fieldItem.dataSource = masterDsInfo.engineName;
    fieldItem.dsId = dsInfo.id;
    if (boardInfo) {
      fieldItem.boardId = boardInfo.id;
      fieldItem.nameAlias = nameAliasList.find(alias => alias.fieldName === fieldItem.name);
      fieldItem.valueAlias = valueAliasList.find(alias => alias.fieldName === fieldItem.name);
    }

    // 메타데이터 정보 설정
    if (dsInfo.uiMetaData && dsInfo.uiMetaData.columns && 0 < dsInfo.uiMetaData.columns.length) {
      const logicalInfo = dsInfo.uiMetaData.columns.find(logical => fieldItem.name === logical.physicalName);
      (logicalInfo) && (fieldItem.uiMetaData = logicalInfo);
    }

    return fieldItem;
  } // function - _setFieldAttribute

  /**
   * 대시보드 및 위젯 초기 설정
   * @param {Dashboard} boardInfo
   * @param {LayoutMode} mode
   * @returns {Dashboard}
   * @private
   */
  private _initWidgetsAndLayout(boardInfo: Dashboard, mode: LayoutMode): Dashboard {

    // 페이지 위젯 정보 설정
    if (boardInfo.widgets) {
      boardInfo.widgets.forEach((widget) => {
        if ('page' === widget.type) {
          const pgeWidget: PageWidget = widget as PageWidget;
          pgeWidget.mode = 'chart';
        }
        widget.dashBoard = boardInfo;
        if (widget.configuration) {
          // widget.configuration['dataSource'] = boardInfo.configuration.dataSource;
          if (boardInfo.configuration.hasOwnProperty('customFields')) {
            widget.configuration['customFields'] = boardInfo.configuration.customFields;
          }
        }
      });
    } else {
      boardInfo.widgets = [];
    }

    // 레이아웃 설정값 입력 및 생성
    (boardInfo.configuration) || (boardInfo.configuration = new BoardConfiguration());

    // 대시보드 생성
    this.initLayout(boardInfo, mode);
    this.renderLayout();

    return boardInfo;
  } // function - _initWidgetsAndLayout

  /**
   * 위젯 아이디로 Layout Component의 컨테이너 객체를 얻는다.
   * @param {string} widgetId
   * @private
   */
  private _getLayoutCompContainerByWidgetId(widgetId: string) {
    const layoutWidget: LayoutWidgetInfo = DashboardUtil.getLayoutWidgetInfoByWidgetId(this.dashboard, widgetId);
    return this._layoutObj.root.getItemsById(layoutWidget.id)[0];
  } // function - _getLayoutCompContainerByWidgetId

  /**
   * 대시보드 서버 스펙을 UI 스펙으로 변경 ( 이전 버전에 대한 데이터 변환 포함 )
   * @param {Dashboard} boardInfo
   * @return {Dashboard}
   * @private
   */
  private _convertSpecToUI(boardInfo: Dashboard): Dashboard {
    (boardInfo.configuration) || (boardInfo.configuration = new BoardConfiguration());
    (boardInfo.configuration.options) || (boardInfo.configuration.options = new BoardGlobalOptions());

    const boardConf: BoardConfiguration = boardInfo.configuration;

    // Convert Server spec to UI spec
    const layoutData: DashboardLayout = new DashboardLayout();
    (boardConf.content) && (layoutData.content = boardConf.content);
    boardConf.layout = layoutData;

    // 대시보드 내 위젯 정보 변환 - Start
    let layoutWidgets: LayoutWidgetInfo[] = boardConf.widgets;
    (layoutWidgets) || (layoutWidgets = []);

    let widgets: Widget[] = boardInfo.widgets;
    (widgets) || (widgets = []);

    layoutWidgets.forEach(item => {
      (isUndefined(item.isSaved)) && (item.isSaved = true);
      (isUndefined(item.isInLayout)) && (item.isInLayout = true);
    });

    if (layoutWidgets.length !== widgets.length) {
      widgets.forEach(item => {
        const idx: number = layoutWidgets.findIndex(widgetItem => widgetItem.ref === item.id);
        (-1 === idx) && (layoutWidgets.push(new LayoutWidgetInfo(item.id, item.type)));
      });
    }

    boardConf.widgets = layoutWidgets;

    // 필터 설정 변경
    let filters = boardConf.filters;
    (filters) || (filters = []);

    filters.forEach((item: Filter, idx: number) => {
      if ('interval' === item.type) {
        // ----> convert IntervalFilter to TimeFilter
        filters[idx] = FilterUtil.convertIntervalToTimeFilter(item as IntervalFilter, boardInfo);
      } else if (FilterUtil.isTimeFilter(item)) {
        // ----> convert TimeFilter ServerSpec to UISpec
        const timeFilter: TimeFilter = item as TimeFilter;
        (timeFilter.timeUnit) || (timeFilter.timeUnit = TimeUnit.NONE);
        timeFilter.clzField = DashboardUtil.getFieldByName(boardInfo, item.dataSource, item.field);
      }
    });

    boardInfo.configuration = boardConf;

    // convert filter to TimeFilter in widget
    boardInfo.widgets.forEach(item => {
      if ('filter' === item.type) {
        const conf = item.configuration as FilterWidgetConfiguration;
        const filter: Filter = conf.filter;
        if (FilterUtil.isTimeFilter(filter)) {
          const timeFilter: TimeFilter = filter as TimeFilter;
          (timeFilter.timeUnit) || (timeFilter.timeUnit = TimeUnit.NONE);
          timeFilter.clzField = DashboardUtil.getFieldByName(boardInfo, filter.dataSource, timeFilter.field);
        } else if ('interval' === filter.type) {
          conf.filter = FilterUtil.convertIntervalToTimeFilter(filter as IntervalFilter, boardInfo);
        }
      } else if ('page' === item.type) {
        const conf: PageWidgetConfiguration = item.configuration as PageWidgetConfiguration;
        if (conf.filters) {
          conf.filters.forEach((filter: Filter, idx: number) => {
            if (FilterUtil.isTimeFilter(filter)) {
              const timeFilter: TimeFilter = filter as TimeFilter;
              (timeFilter.timeUnit) || (timeFilter.timeUnit = TimeUnit.NONE);
              timeFilter.clzField = DashboardUtil.getFieldByName(boardInfo, conf.dataSource.engineName, timeFilter.field);
            } else if ('interval' === filter.type) {
              conf.filters[idx] = FilterUtil.convertIntervalToTimeFilter(filter as IntervalFilter, boardInfo);
            }
          });
        }
      }
    });

    return boardInfo;
  } // function - _convertSpecToUI

  /**
   * Dynamic Widget Component 등록
   * @param container
   * @param componentState
   * @private
   */
  private _bootstrapWidgetComponent(container, componentState) {

    const widgetInfo: Widget = DashboardUtil.getWidgetByLayoutComponentId(this.dashboard, componentState.id);

    if (widgetInfo) {

      const $componentContainer = $('<div/>').css({width: '100%', height: '100%'});
      container.getElement().prepend($componentContainer);
      const widgetCompFactory = this.componentFactoryResolver.resolveComponentFactory(DashboardWidgetComponent);
      const widgetComp = this.appRef.bootstrap(widgetCompFactory, $componentContainer.get(0));

      widgetInfo.dashBoard = this.dashboard;

      this.dashboard = DashboardUtil.setUseWidgetInLayout(this.dashboard, widgetInfo.id, true);

      widgetComp.instance.init(
        widgetInfo, DashboardUtil.getBoardWidgetOptions(this.dashboard),
        this._layoutMode, DashboardUtil.getLayoutWidgetInfoByWidgetId(this.dashboard, widgetInfo.id)
      );

      this._widgetComps.push(widgetComp);
    } else {
      this._invalidLayoutWidgets.push(componentState.id);
    }
  } // function - _bootstrapWidgetComponent

  /**
   * Dynamic Widget Header Component 등록
   * @param stack
   * @param {BoardGlobalOptions} _globalOpts
   * @private
   */
  private _bootstrapWidgetHeaderComponent(stack, _globalOpts: BoardGlobalOptions) {
    const componentState: any = stack.config.content[0];
    if (componentState) {
      const widgetInfo: Widget = DashboardUtil.getWidgetByLayoutComponentId(this.dashboard, componentState.id);

      if (widgetInfo) {
        const layoutWidgets: LayoutWidgetInfo[] = DashboardUtil.getLayoutWidgetInfos(this.dashboard);
        const widgetHeaderCompFactory
          = this.componentFactoryResolver.resolveComponentFactory(DashboardWidgetHeaderComponent);
        const widgetHeaderComp = this.appRef.bootstrap(widgetHeaderCompFactory, stack.header.tabs[0].element.get(0));
        widgetHeaderComp.instance.widget = widgetInfo;
        widgetHeaderComp.instance.layoutMode = this._layoutMode;
        widgetHeaderComp.instance.isShowTitle = layoutWidgets.find(item => item.id === componentState.id).title;
        this._widgetHeaderComps.push(widgetHeaderComp);
      }
    }
  } // function - _bootstrapWidgetHeaderComponent

  /**
   * 날짜 변환
   * @param filter
   * @private
   */
  private _convertDateTimeFormat(filter: TimeRangeFilter|TimeDateFilter): string[] {
    return filter.intervals.map(item => {
      const arrInterval: any[] = item.split('/');
      if (TimeRangeFilter.EARLIEST_DATETIME !== arrInterval[0] && TimeRangeFilter.LATEST_DATETIME !== arrInterval[0]) {
        const startDate = arrInterval[0].replace('.000Z', '').replace('T', ' ');
        // if( ( TimeUnit.YEAR === filter.timeUnit && !/^[0-9]{4}$/.test(startDate) )
        //   || ( TimeUnit.MONTH === filter.timeUnit && !/^[0-9]{4}-[0-9]{2}$/.test(startDate) )
        //   || ( TimeUnit.WEEK === filter.timeUnit && !/^[0-9]{4}-[0-9]{1,2}$/.test(startDate) )
        //   || ( TimeUnit.DAY === filter.timeUnit && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(startDate) )
        //   || ( TimeUnit.HOUR === filter.timeUnit && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}\s[0-9]{2}$/.test(startDate) )
        //   || ( TimeUnit.MINUTE === filter.timeUnit && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}\s[0-9]{2}-[0-9]{2}$/.test(startDate) )
        //   || ( TimeUnit.SECOND === filter.timeUnit && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}\s[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(startDate) )) {
        //   arrInterval[0] = FilterUtil.getDateTimeFormat(startDate, filter.timeUnit, true);
        // }
        arrInterval[0] = FilterUtil.getDateTimeFormat(startDate, filter.timeUnit, true);
      }

      if (TimeRangeFilter.EARLIEST_DATETIME !== arrInterval[1] && TimeRangeFilter.LATEST_DATETIME !== arrInterval[1]) {
        const endDate = arrInterval[1].replace('.000Z', '').replace('T', ' ');
        // if( ( TimeUnit.YEAR === filter.timeUnit && !/^[0-9]{4}$/.test(endDate) )
        //   || ( TimeUnit.MONTH === filter.timeUnit && !/^[0-9]{4}-[0-9]{2}$/.test(endDate) )
        //   || ( TimeUnit.WEEK === filter.timeUnit && !/^[0-9]{4}-[0-9]{1,2}$/.test(endDate) )
        //   || ( TimeUnit.DAY === filter.timeUnit && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(endDate) )
        //   || ( TimeUnit.HOUR === filter.timeUnit && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}\s[0-9]{2}$/.test(endDate) )
        //   || ( TimeUnit.MINUTE === filter.timeUnit && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}\s[0-9]{2}-[0-9]{2}$/.test(endDate) )
        //   || ( TimeUnit.SECOND === filter.timeUnit && !/^[0-9]{4}-[0-9]{2}-[0-9]{2}\s[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(endDate) )) {
        //   arrInterval[1] = FilterUtil.getDateTimeFormat(endDate, filter.timeUnit, true);
        // }
        arrInterval[1] = FilterUtil.getDateTimeFormat(endDate, filter.timeUnit, true);
      }
      return arrInterval[0] + '/' + arrInterval[1];
    });
  } // function - _convertDateTimeFormat

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Protected Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 레이아웃 내에 신규 위젯 추가
   * @param {Widget[]} newWidgets
   * @protected
   */
  protected appendWidgetInLayout(newWidgets: Widget[]) {
    if (newWidgets && 0 < newWidgets.length) {
      newWidgets.forEach(item => {
        const newItemConfig = this._getLayoutComponentConfByWidget(item);
        if( newItemConfig ) {
          const rootItem: any = this._layoutObj.root;
          const rowItems: any[] = rootItem.getItemsByType('row');
          const colItems: any[] = rootItem.getItemsByType('column');
          const stackItems: any[] = rootItem.getItemsByType('stack');
          if (0 < rowItems.length) {
            rowItems[0].addChild(newItemConfig);
          } else if (0 < colItems.length) {
            colItems[0].addChild(newItemConfig);
          } else if (0 < stackItems.length) {
            const newRowItem = rootItem.layoutManager.createContentItem({type: 'row'}, rootItem);
            rootItem.replaceChild(stackItems[0], newRowItem);
            newRowItem.addChild(stackItems[0]);
            newRowItem.addChild(newItemConfig);
          } else {
            rootItem.addChild({type: 'row', content: [newItemConfig]});
          }
        }
      });
      this.updateLayoutSize();
    }
  } // function - appendWidgetInLayout

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 위젯의 사이즈를 조정한다
   */
  public updateLayoutSize() {
    if (this._isCompleteLayoutLoad) {
      setTimeout(() => {
        (this._layoutObj) && (this._layoutObj.updateSize());
      }, 100);  // <== 화면 변경이 적용된 후에 리사이즈를 하기 위해서 시간 지연을 줌
    }
  } // function - updateLayoutSize

  /**
   * 대시보드 설정을 바탕으로 레이아웃 초기 설정을 한다
   * @param {Dashboard} board
   * @param {LayoutMode} mode
   */
  public initLayout(board: Dashboard, mode: LayoutMode) {

    // 데이터 초기화
    this._initConf();

    // 레이아웃 설정
    (board.configuration) && (board.configuration = _.merge(new BoardConfiguration(), board.configuration));

    // 모드별 설정
    this._layoutMode = mode;
    switch (mode) {
      case LayoutMode.EDIT :
        board.configuration.layout.settings.hasHeaders = true;
        board.configuration.layout.settings.showMaximiseIcon = false;
        board.configuration.layout.settings.constrainDragToContainer = true;
        board.configuration.layout.settings.reorderEnabled = true;
        board.configuration.layout.settings.enableComponentResize = true;
        break;
      default :
        board.configuration.layout.settings.hasHeaders = false;
        board.configuration.layout.settings.showMaximiseIcon = false;
        board.configuration.layout.settings.constrainDragToContainer = false;
        board.configuration.layout.settings.reorderEnabled = false;
        board.configuration.layout.settings.enableComponentResize = false;
        break;
    }

    // 공백 설정
    board.configuration.layout.dimensions.borderWidth = board.configuration.options.layout.widgetPadding;

    this.dashboard = board;
  } // function - initLayout

  /**
   * 위젯을 새로불러온다.
   */
  public reloadWidget(widgetInfo: Widget) {
    const widgetCompRef: ComponentRef<DashboardWidgetComponent> = this._getWidgetComponentRef(widgetInfo.id);
    if (widgetCompRef) {
      // 기존 위젯 제거
      widgetCompRef.destroy();
      this._widgetComps = this._widgetComps.filter(item => (widgetInfo.id !== item.instance.getWidgetId()));

      // 신규 위젯 인스턴스 추가
      const $widgetContainer = this._getLayoutCompContainerByWidgetId(widgetInfo.id);
      const $componentContainer = $('<div/>').css({width: '100%', height: '100%'});
      $widgetContainer.container.getElement().append($componentContainer);
      const widgetCompFactory = this.componentFactoryResolver.resolveComponentFactory(DashboardWidgetComponent);
      const widgetComp = this.appRef.bootstrap(widgetCompFactory, $componentContainer.get(0));
      widgetComp.instance.init(
        widgetInfo, DashboardUtil.getBoardWidgetOptions(this.dashboard),
        this._layoutMode, DashboardUtil.getLayoutWidgetInfoByWidgetId(this.dashboard, widgetInfo.id)
      );
      this._widgetComps.push(widgetComp);

      // 헤더 widget 정보 변경
      this._getWidgetHeaderComp(widgetInfo.id).widget = widgetInfo;

      // 변경 적용
      this.changeDetect.detectChanges();
    }
  } // function - reloadWidget

  /**
   * 레이아웃 생성
   */
  public renderLayout() {

    if (0 < DashboardUtil.getWidgets(this.dashboard).length) {

      const dashboard: Dashboard = this.dashboard;
      const objLayout: DashboardLayout = dashboard.configuration.layout;
      const layoutWidgets: LayoutWidgetInfo[] = DashboardUtil.getLayoutWidgetInfos(dashboard);
      const globalOpts: BoardGlobalOptions = dashboard.configuration.options;
      const globalOptsLayout: BoardLayoutOptions = globalOpts.layout;
      let isInitialisedLayout: boolean = false;

      if (!this._layoutObj) {

        // 초기 생성 시 로딩바 표시
        if (0 < layoutWidgets.filter(item => item.isInLayout).length) {
          this.showBoardLoading();
        }

        // 레이아웃을 생성하는 경우
        this.changeDetect.detectChanges();
        if (!this.layoutContainer) {
          this._updateLayoutFinished();
          return;
        }
        this._widgetComps = [];
        this._$layoutContainer = $(this.layoutContainer.nativeElement);
        this._$layoutContainer.parent().css({height: '', overflow: ''});    // remove height

        if (BoardLayoutType.FIT_TO_HEIGHT === globalOptsLayout.layoutType) {
          if (this._$layoutContainer.parent().height() > globalOptsLayout.layoutHeight) {
            this._$layoutContainer.parent().css({height: globalOptsLayout.layoutHeight});
          }
          this._$layoutContainer.css({height: globalOptsLayout.layoutHeight});
        } else {
          this._$layoutContainer.parent().css('overflow', 'hidden');
          objLayout.dimensions.height = '100%';
        }
        objLayout.dimensions.width = '100%';

        // 레이아웃 생성 및 위젯 등록 방식 지정
        this._layoutObj = new GoldenLayout(objLayout, this._$layoutContainer);
        // 위젯 추가에 대한 처리
        this._layoutObj.registerComponent('widget',
          ((scope) => {
            // tslint:disable-next-line:only-arrow-functions
            return function (container, componentState) {
              scope._bootstrapWidgetComponent(container, componentState);
            }
          })(this)
        );

        // 레이아웃 변경에 대한 이벤트 처리
        this._layoutObj.on('stateChanged', () => {
          if (this._layoutObj && isInitialisedLayout) {
            this.broadCaster.broadcast('RESIZE_WIDGET');            // 위젯 리사이즈 호출
            objLayout.content = this._layoutObj.toConfig().content;   // 변경 사항 저장
          }
        });

        // 레이아웃 초기 생성에 대한 이벤트 처리
        this._layoutObj.on('initialised', () => {
          isInitialisedLayout = true;
          if (0 === layoutWidgets.length) {
            this._updateLayoutFinished();
          }

          this._invalidLayoutWidgets.forEach(item => {
            const tempData = this._layoutObj.root.getItemsById(item);
            (tempData && tempData[0]) && (tempData[0].remove());
          });
        });

        // 레이아웃 스택이 생성되었을 때의 이벤트 처리 -> Header 기능 정의private _convertSpecToServer(param: any) {
        this._layoutObj.on('stackCreated', (stack) => {
          if (LayoutMode.EDIT === this._layoutMode) {
            setTimeout(() => {
              this._bootstrapWidgetHeaderComponent(stack, globalOpts);
            }, 200);
          }
        });

        this._layoutObj.init();
      } // end if - (!this._layoutObj)

      // 신규 위젯 정보 판별
      const newWidgets
        = layoutWidgets
        .filter(item => item.isInLayout && 0 === this._layoutObj.root.getItemsById(item.id).length)
        .map(item => DashboardUtil.getWidget(this.dashboard, item.ref));

      this.appendWidgetInLayout(newWidgets);
    } else {
      this.onLayoutInitialised();
      this.hideBoardLoading();
    }
  } // function - renderLayout

  /**
   * Layout 초기 로딩 완료 이벤트 핸들러
   */
  public abstract onLayoutInitialised();

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Protected Method - Common Method
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/

  /**
   * 글로벌 필터 설정
   * @param {Dashboard} dashboard
   * @return {Dashboard}
   */
  protected initializeBoardFilters(dashboard: Dashboard): Dashboard {

    const boardConf: BoardConfiguration = dashboard.configuration;
    const savedFilters: Filter[] = _.cloneDeep(boardConf.filters);

    // 기본 필수/추천 필터 정보 설정 - Start
    let genFilters: Filter[] = [];
    {
      const dsList: Datasource[] = DashboardUtil.getMainDataSources(dashboard);
      dsList.forEach((dsInfo: Datasource) => {
        const fields = DashboardUtil.getFieldsForMainDataSource(boardConf, dsInfo.engineName);

        let recommendFilters: Filter[] = [];
        // 추천필터 설정
        fields.forEach((field: Field) => {
          if (field.filtering) {
            let rcmdFilter: Filter;
            if (field.logicalType === LogicalType.TIMESTAMP) {
              rcmdFilter = FilterUtil.getTimeRangeFilter(field, TimeUnit.NONE, 'recommended', dsInfo, dashboard);
            } else {
              rcmdFilter = FilterUtil.getBasicInclusionFilter(field, 'recommended');
            }

            if (rcmdFilter) {

              // 대시보드 필터 설정 ( 기본 데이터와 저장된 정보와의 병합 ) - Start
              if (savedFilters && 0 < savedFilters.length) {
                const savedIdx: number = savedFilters.findIndex((item: Filter) => {
                  return item.field === field.name && item.dataSource === dsInfo.engineName;
                });
                if (-1 < savedIdx) {
                  const savedItem: Filter = savedFilters[savedIdx];
                  savedFilters.splice(savedIdx, 1);
                  rcmdFilter = _.merge(rcmdFilter, savedItem);   // 필수/추천 필터 병합
                }
              }
              // 대시보드 필터 설정 ( 기본 데이터와 저장된 정보와의 병합 ) - End

              recommendFilters.push(rcmdFilter);
            } // function - rcmdFilter
          }
        });

        recommendFilters = _.orderBy(recommendFilters, (item) => (item.ui) ? item.ui.filteringSeq : '', 'asc');
        genFilters = genFilters.concat(recommendFilters);
      });
    }
    // 기본 필수/추천 필터 정보 설정 - End

    // 대시보드 필터 설정 ( 기본 데이터와 저장된 정보와의 병합 ) - Start
    if (savedFilters && 0 < savedFilters.length) {

      let totalFields: (Field | CustomField)[] = _.cloneDeep(boardConf.fields);
      (boardConf.customFields) && (totalFields = totalFields.concat(_.cloneDeep(boardConf.customFields)));

      boardConf.filters = genFilters.concat(
        savedFilters.map((savedItem: Filter) => {
          const filterField: Field = totalFields.find(field => field.name === savedItem.field) as Field;
          if (filterField) {
            if (filterField.role === FieldRole.MEASURE) {
              // 측정값 필터
              return _.merge(FilterUtil.getBasicBoundFilter(filterField), savedItem);
            } else if (filterField.logicalType === LogicalType.TIMESTAMP) {
              // 타임 스탬프 필터
              return _.merge(new TimeFilter(filterField), savedItem);
            } else {
              // 차원값 필터
              return _.merge(FilterUtil.getBasicInclusionFilter(filterField), savedItem);
            }
          } else {
            return savedItem;
          }
        })
      );

    } else {
      boardConf.filters = genFilters;
    }
    // 대시보드 필터 설정 ( 기본 데이터와 저장된 정보와의 병합 ) - End

    return dashboard;
  } // function - initializeBoardFilters

  /**
   * 초기 필터 설정 ( 글로벌 및 리커멘드 필터 )
   * @param {Dashboard} boardInfo
   * @return {Promise<Dashboard>}
   */
  protected initializeFilter(boardInfo: Dashboard): Promise<Dashboard> {
    return new Promise<any>((res1, rej1) => {
      const promises = [];
      boardInfo = this.initializeBoardFilters(boardInfo);

      const boardFilters: Filter[] = boardInfo.configuration.filters;
      const dsList: Datasource[] = DashboardUtil.getMainDataSources(boardInfo);

      // 데이터소스별 추천 필터 설정
      dsList.forEach((dsInfo: Datasource) => {
        // if (ConnectionType.LINK !== dsInfo.connType) {
        promises.push(new Promise<any>((res2, rej2) => {
          // 데이터소스의 필터 목록
          const dsFilters: Filter[] = boardFilters.filter(filter => filter.dataSource === dsInfo.engineName);
          // 최초 추천 필터
          const firstFilter: Filter = dsFilters.find(filter => {
            return 'recommended' === filter.ui.importanceType && 1 === filter.ui.filteringSeq;
          });

          if (firstFilter
            && ((firstFilter['valueList'] && 0 === firstFilter['valueList'].length) || (firstFilter['intervals'] && 0 === firstFilter['intervals'].length))) {
            // 필터의 값이 사전에 정의 안되어 있는 경우

            const prevFilters: Filter[] = dsFilters.filter(item => item.ui.filteringSeq < firstFilter.ui.filteringSeq);
            this.setRecommandedFilter(firstFilter, prevFilters, dsFilters, boardInfo).then(() => {
              console.log('초기화 완료');
              res2(null);
            }).catch(() => rej2());
          } else {
            console.log('셋팅 되어 있음 or 값이 없음');
            res2(null);
          }
        }));
        // }
      });

      Promise.all(promises).then(() => {
        console.log('filter initializeFilter');
        res1(boardInfo);
      }).catch((error) => {
        console.log('filter initializeFilter error', error);
        rej1(error);
      });
    });
  } // function - initializeFilter

  /**
   * 추천 필터 재설정
   * @param {Filter} targetFilter
   * @param {Filter[]} prevFilters
   * @param {Filter[]} dsFilters
   * @param {Dashboard} dashboard
   * @return {Promise<any>}
   */
  protected setRecommandedFilter(targetFilter: Filter, prevFilters: Filter[], dsFilters: Filter[], dashboard: Dashboard): Promise<any> {

    // candidate 서비스 요청
    return this.datasourceService.getCandidateForFilter(targetFilter, dashboard, prevFilters).then((result) => {

      // 결과데이터로 필터에 값 셋팅
      if (targetFilter.type === 'include') {
        if (result && result.length > 0) {
          if (result[0].field) targetFilter['valueList'] = [result[0].field];
          else targetFilter['valueList'] = [result[0][targetFilter.field]];
        } else {
          targetFilter['valueList'] = [];
        }
      } else {
        targetFilter['intervals'] = [
          result['minTime'] + '/' + result['maxTime']
        ];
      }

      // 필터가 업데이트 된 것을 알림
      this.popupService.notiFilter({
        name: 'change-recommended-filter-value',
        data: targetFilter
      });

      // api용 파라미터 filters에 현재 필터 추가
      prevFilters.push(targetFilter);

      // 다음 필터 처리
      const nextFilter: Filter = dsFilters.find(item => item.ui.filteringSeq === (targetFilter.ui.filteringSeq + 1));
      if (nextFilter) {
        // 다음 필터가 있을 경우
        return this.setRecommandedFilter(nextFilter, prevFilters, dsFilters, dashboard);
      } else {
        // 다음 필터가 없거나 일반 필터일 경우 종료
        return result;
      }
    });
  } // function - setRecommandedFilter

  /*-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
   | Public Method - API
   |-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=*/
  /**
   * Show Loading
   * Display Dashboard loading when in viewing mode
   * When in edit mode, display as full loading
   */
  public showBoardLoading() {
    if (LayoutMode.EDIT === this._layoutMode) {
      this.loadingShow();
    } else {
      if( !this.isVisibleLoading() ) {
        const isRealTimeBoard: boolean = this.dashboard && this.dashboard.configuration.options.sync && this.dashboard.configuration.options.sync.enabled;
        (isRealTimeBoard) || (this.isShowDashboardLoading = true);
      }
    }
    this.safelyDetectChanges();
  } // function - showBoardLoading

  /**
   * Hide Loading
   */
  public hideBoardLoading() {
    if (LayoutMode.EDIT === this._layoutMode) {
      this.loadingHide();
    } else {
      this.isShowDashboardLoading = false;
      if( this.isVisibleLoading() ) {
        this.loadingHide();
      }
    }
    this.safelyDetectChanges();
  } // function - hideBoardLoading

  /**
   * 저장을 위해 스크린에 맞는 형태로 사이즈를 조절한다
   */
  public resizeToFitScreenForSave() {
    this._$layoutContainer.parent().css({height: '', overflow: 'hidden'});    // remove height
    this._$layoutContainer.width('100%').height('100%');
    this.updateLayoutSize();
  } // function - resizeToFitScreenForSave

  /**
   * 레이아웃 설정을 적용한다.
   * @param {BoardConfiguration} conf
   */
  public refreshLayout(conf?: BoardConfiguration) {
    this.dashboard = DashboardUtil.updateBoardConfiguration(this.dashboard, conf);

    const widgetGlobalOpts: BoardWidgetOptions = DashboardUtil.getBoardWidgetOptions(this.dashboard);
    if (widgetGlobalOpts) {
      DashboardUtil.getPageWidgets(this.dashboard).forEach((widgetItem: PageWidget) => {
        const chartConf = widgetItem.configuration['chart'];
        if (chartConf.legend && WidgetShowType.BY_WIDGET !== widgetGlobalOpts.showLegend) {
          chartConf.legend.auto = (WidgetShowType.ON === widgetGlobalOpts.showLegend);
        }
        if (chartConf.chartZooms && WidgetShowType.BY_WIDGET !== widgetGlobalOpts.showMinimap) {
          chartConf.chartZooms[0].auto = (WidgetShowType.ON === widgetGlobalOpts.showMinimap);
        }
      });
    }
    this._setForceLayout();
  } // function - refreshLayout

  /**
   * 위젯이 레이아웃 내에 배치되어 있는지 여부를 반환한다.
   * @param {string} widgetId
   * @returns {boolean}
   */
  public isWidgetInLayout(widgetId: string): boolean {
    const infoList: LayoutWidgetInfo[] = DashboardUtil.getLayoutWidgetInfos(this.dashboard);
    if (infoList) {
      const info: LayoutWidgetInfo = infoList.find(item => item.ref === widgetId);
      return info ? info.isInLayout : false;
    } else {
      return false;
    }
  } // function - isWidgetInLayout

  /**
   * 위젯 컴포넌트 목록을 반환한다.
   */
  public getWidgetComps(): DashboardWidgetComponent[] {
    return (this._widgetComps && this._widgetComps.length > 0) ? this._widgetComps.map(item => item.instance) : [];
  } // function - getWidgetComps

  /**
   * 특정 위젯 컴포넌트를 반환한다.
   * @param {string} widgetId
   */
  public getWidgetComp(widgetId: string) {
    const widgetComps = this._widgetComps.map(item => item.instance).filter(item => item.getWidgetId() === widgetId);
    return (widgetComps && 0 < widgetComps.length) ? widgetComps[0] : null;
  } // function - getWidgetComp

  /**
   * 특정 엘레멘트를 Layout의 드래그 소스로 추가한다.
   * @param element
   * @param {Widget} item
   */
  public setDragSource(element: any, item: Widget) {
    if( !!element && !!item ) {
      (this._layoutObj) && (this._layoutObj.createDragSource($(element), this._getLayoutComponentConfByWidget(item)));
    }
  } // function - setDragSource

  /**
   * 전체 드래그소스를 제거한다.
   */
  public destroyDragSources() {
    (this._layoutObj) && (this._layoutObj.destroyDragSources());
  } // function - destroyDragSources

  /**
   * 레아아웃 컨텐츠 정보를 얻는다.
   * @return {any[]}
   */
  public getLayoutContent(): LayoutContent[] {
    return this._layoutObj.toConfig().content;
  } // function - getLayoutContent

  /**
   * Destroy dashboard
   */
  public destroyDashboard() {
    if (this._widgetComps && 0 < this._widgetComps.length) {
      this._widgetHeaderComps.forEach(item => item.destroy());
      this._widgetComps.forEach(item => item.destroy());
    }
    (this._layoutObj) && (this._layoutObj.destroy());
    this._layoutObj = null;
  } // function - destroyDashboard

  /**
   * 대시보드 설정
   * @param {Dashboard} boardInfo
   * @param {LayoutMode} mode
   * @return {Promise<[Dashboard , Datasource]>}
   */
  public initializeDashboard(boardInfo: Dashboard, mode: LayoutMode): Promise<Dashboard> {

    return new Promise<any>((resolve) => {

      // 대시보드에 데이터소스 설정
      const result: [Dashboard, Datasource] = this._setDatasourceForDashboard(boardInfo);
      boardInfo = result[0];

      // Data migration
      {
        // convert map old spec or filter widget
        boardInfo.widgets.forEach(widget => {
          if ('page' === widget.type && ChartType.MAP === (widget.configuration as PageWidgetConfiguration).chart.type) {
            const widgetConf: PageWidgetConfiguration = widget.configuration as PageWidgetConfiguration;
            widgetConf.shelf.layers
              = widgetConf.shelf.layers.map((layer, idx: number) => {
              if (Array === layer.constructor) {
                // Old Spec ( Only Single Layer )
                return {
                  name: 'layer' + (idx + 1),
                  ref: widgetConf.dataSource.engineName,
                  fields: [].concat(layer)
                };
              } else {
                if ('' === layer.ref) {
                  layer.ref = boardInfo.configuration.fields.find(field => field.name === layer.fields[0].name).dataSource;
                }
                return layer;
              }
            });
            widgetConf.dataSource = boardInfo.configuration.dataSource; // 무조건!! 위 shelf migration 보다 나중에!! 실행되어야 한다.
          } else if ('filter' === widget.type) {
            const widgetConf: FilterWidgetConfiguration = widget.configuration as FilterWidgetConfiguration;
            if (!widgetConf.filter) {
              widgetConf.filter = {} as any;
              Object.keys(widgetConf).forEach(key => {
                widgetConf.filter[key] = widgetConf[key];
              });
            }
            if (this.filterUtil.isTimeRangeFilter(widgetConf.filter) || this.filterUtil.isTimeSingleFilter(widgetConf.filter)) {
              const rangeFilter = widgetConf.filter as TimeRangeFilter;
              widgetConf.filter['intervals'] = this._convertDateTimeFormat(rangeFilter);
            }
          }
        });

        // remove duplicate filters
        const filters: Filter[] = boardInfo.configuration.filters;
        if (filters) {
          boardInfo.configuration.filters
            = filters.reduce((acc: Filter[], curr: Filter) => {
            if (!acc.some(item => item.dataSource === curr.dataSource && item.field === curr.field)) {
              acc.push(curr);
            }
            return acc;
          }, []);
          boardInfo.configuration.filters.forEach(filter => {
            if (this.filterUtil.isTimeRangeFilter(filter) || this.filterUtil.isTimeSingleFilter(filter)) {
              const rangeFilter = filter as TimeRangeFilter;
              filter['intervals'] = this._convertDateTimeFormat(rangeFilter);
            }
          });
        }

        // Updating information about deleted dataSources
        const boardDataSource: BoardDataSource = boardInfo.configuration.dataSource;
        const dataSource: Datasource[] = boardInfo.dataSources;
        if ('multi' === boardDataSource.type) {
          boardDataSource.dataSources
            = boardDataSource.dataSources.filter((boardDs: BoardDataSource) => {
            if (dataSource.some(item => DashboardUtil.isSameDataSource(boardDs, item))) {
              return true;
            } else {
              const engineName: string = boardDs.engineName ? boardDs.engineName : boardDs.name;
              if (boardInfo.configuration.filters) {
                boardInfo.configuration.filters
                  = boardInfo.configuration.filters.filter(item => item.dataSource !== engineName);
              }
              this._removeDsEngineNames.push(engineName);
              return false;
            }
          });

          boardDataSource.associations
            = boardDataSource.associations.filter((ass: BoardDataSourceRelation) => {
            return !(
              this._removeDsEngineNames.some(item => item === ass.source)
              || this._removeDsEngineNames.some(item => item === ass.target)
            )
          });

        } else {
          if (isNullOrUndefined(dataSource) || 0 === dataSource.length) {
            this._removeDsEngineNames.push(boardDataSource.engineName);
            boardInfo.configuration.dataSource = null;
          }
        }

        boardInfo = DashboardUtil.convertSpecToUI(boardInfo);
      } // end of data migration

      // getCandidate For TimeRange Max value
      const timestampFields = boardInfo.dataSources.reduce((acc, dsInfo) => {
        acc.push(
          ...dsInfo.fields
            .filter( fieldInfo => LogicalType.TIMESTAMP === fieldInfo.logicalType )
            .map( fieldInfo => {
              return {
                dsInfo: dsInfo,
                field: fieldInfo
              };
            })
        );
        return acc;
      }, []);

      boardInfo.timeRanges = [];
      const procCandidate: ((callback) => void)[] = timestampFields.map( fieldInfo => {
        return (callback) => {
          // 시간 필터의 범위값을 알기 위해서 조회함
          this.datasourceService.getCandidateForTimestamp(fieldInfo, boardInfo).then(rangeResult => {
            if (rangeResult) {
              const timeRangeInfo = {
                fieldName : fieldInfo.field.name,
                maxTime : rangeResult.maxTime,
                minTime : rangeResult.minTime,
                dataSource: fieldInfo.dsInfo
              };
              boardInfo.timeRanges.push(timeRangeInfo);
            }
            callback();
          }).catch(() => callback())
        };
      })

      async.waterfall(procCandidate, () => {

        // 글로벌 필터 셋팅
        this.initializeFilter(boardInfo).then((boardData) => {

          boardInfo = boardData;

          const promises = [];
          if (boardInfo.configuration.filters) {

            const filterIdList = boardInfo.widgets.filter((widget) => widget.type == 'filter').map(widget => widget.id);

            if(this.isNullOrUndefined(boardInfo.configuration.filterRelations)){
              boardInfo.configuration.filterRelations = [];
            }
            const filterRelation = boardInfo.configuration.filterRelations;

            const recurrsiveRelation = (items: DashboardWidgetRelation[], hierarchy: { node: string, parent: string }[] = [], parentId: string) => {
              items.forEach((relItem: DashboardWidgetRelation) => {
                hierarchy.push({
                  node: relItem.ref,
                  parent: parentId
                });

                if (relItem.children && 0 < relItem.children.length) {
                  hierarchy = recurrsiveRelation(relItem.children, [].concat(hierarchy), relItem.ref);
                }
              });
              return hierarchy;
            };

            const hierarchyList = recurrsiveRelation(filterRelation, [], '');

            // 상위 계층 설정이 안되어 있으나 rel 값이 없는 필터일 경우 본인 과의 rel 설정
            filterIdList.forEach((id)=> {
              if(!filterRelation.some(filterRel => filterRel.ref === id)
                && (hierarchyList.length == 0 || hierarchyList.find(hierarchy => hierarchy.node === id && hierarchy.parent ===''))){
                boardInfo.configuration.filterRelations.push(new DashboardWidgetRelation(id));
              }
            });

            // // hierarchy 가 없이 저장된 필터 제외
            // const filterRelation = boardInfo.configuration.filterRelations;
            // console.log('filterRelation: ,', filterRelation);
            //
            // const hierarchyIdList = [];
            //
            // filterRelation.forEach(filterRel => {
            //   const filterWidget = (DashboardUtil.getWidget(this.dashboard, filterRel.ref) as FilterWidget);
            //
            //   if(!this.isNullOrUndefined(filterWidget)){
            //     hierarchyIdList.push(filterWidget.configuration.filter.dataSource + '_' + filterWidget.configuration.filter.field);
            //   }
            // });
            //
            // boardInfo.configuration.filters = boardInfo.configuration.filters.filter((filter: Filter) => {
            //   const filterId = filter.dataSource + '_' + filter.field;
            //   return hierarchyIdList.includes(filterId);
            // });

            // remove current_time timestamp filter - S
            boardInfo.configuration.filters
              = boardInfo.configuration.filters.filter((filter: Filter) => {
              if (FilterUtil.isTimeFilter(filter) && filter['clzField']) {
                const filterField: Field = (filter as TimeFilter).clzField;
                if (FieldRole.TIMESTAMP === filterField.role && CommonConstant.COL_NAME_CURRENT_DATETIME === filterField.name) {
                  const filterId: string = filter.dataSource + '_' + filter.field;
                  const filterWidgets: Widget[] = boardInfo.widgets.filter(widget => {
                    if ('filter' === widget.type) {
                      const filterInWidget: Filter = (widget.configuration as FilterWidgetConfiguration).filter;
                      return (filterInWidget.dataSource + '_' + filterInWidget.field === filterId);
                    }
                  });

                  filterWidgets.forEach((item) => {
                    promises.push(new Promise((res) => {
                      this.widgetService.deleteWidget(item.id)
                        .then(() => {
                          console.log('+=+=+=+=+=+=+=+=+=+=+=+=+=+=+= remove current_time filter');
                          boardInfo.widgets = boardInfo.widgets.filter(widgetItem => widgetItem.id !== item.id);
                          res(null);
                        });
                    }));
                  });

                  return false;
                } else {
                  return true;
                }
              } else {
                return true;
              }
            });
            // remove current_time timestamp filter - E

            // Adjust filter widget information error - S
            boardInfo.configuration.filters.forEach((filter: Filter) => {

              // add missing widget or remove duplicate widget
              const filterId: string = filter.dataSource + '_' + filter.field;
              const filterWidgets: Widget[] = boardInfo.widgets.filter(widget => {
                if ('filter' === widget.type) {
                  const filterInWidget: Filter = (widget.configuration as FilterWidgetConfiguration).filter;
                  return (filterInWidget.dataSource + '_' + filterInWidget.field === filterId);
                }
              });

              if (0 === filterWidgets.length) {
                // 필터위젯 정보가 없는 필터의 경우 - 필터 위젯 정보 생성
                promises.push(new Promise((res) => {
                  this.widgetService.createWidget(new FilterWidget(filter, boardInfo), boardInfo.id)
                    .then(createResult => {
                      boardInfo.widgets.push(createResult);
                      res(null);
                    });
                }));
              } else {
                // 동일한 필드에 대해서 필터가 1개 이상일 경우에 삭제 등록
                filterWidgets.forEach((item, index) => {
                  if (0 < index) {
                    promises.push(new Promise((res) => {
                      this.widgetService.deleteWidget(item.id)
                        .then(() => {
                          boardInfo.widgets = boardInfo.widgets.filter(widgetItem => widgetItem.id !== item.id);
                          res(null);
                        });
                    }));
                  }
                });
              }
            });
            // Adjust filter widget information error - E

            // set filter relation
            if (boardInfo.widgets && !boardInfo.configuration.filterRelations) {
              boardInfo.configuration.filterRelations = [];
              boardInfo.widgets.forEach(widget => {
                if ('filter' === widget.type) {
                  const widgetFilter = (widget as FilterWidget).configuration.filter;
                  if (boardInfo.configuration.filters.some(filterItem => {
                    if (widgetFilter.dataSource === filterItem.dataSource && widgetFilter.field === filterItem.field) {
                      return 'recommended' !== filterItem.ui.importanceType;
                    } else {
                      return false;
                    }
                  })) {
                    // 일반 필터만 추가함
                    if (!this._findWidgetRelation(widget.id, boardInfo.configuration.filterRelations, [], () => true)) {
                      // 필터 relation 을 생성한다.
                      (boardInfo.configuration.filterRelations) || (boardInfo.configuration.filterRelations = []);
                      this._addWidgetRelation(widget.id, boardInfo.configuration.filterRelations);
                      boardInfo['change'] = true;
                    }
                  }
                }
              });
            } // end if - filterRelations

            // 필터 관계 맵 생성
            this._generateFilterRelationMap(boardInfo);

          } // end if - filters

          Promise.all(promises).then(() => {
            // 데이터 변환
            boardInfo = this._convertSpecToUI(boardInfo);
            boardInfo = this._initWidgetsAndLayout(boardInfo, mode);
            resolve(boardInfo);
          }).catch(() => {
            boardInfo = this._convertSpecToUI(boardInfo);
            boardInfo = this._initWidgetsAndLayout(boardInfo, mode);
            resolve(boardInfo);
          });

        }).catch(() => {
          boardInfo = this._convertSpecToUI(boardInfo);
          boardInfo = this._initWidgetsAndLayout(boardInfo, mode);
          resolve(boardInfo);
        });
      })

    });

  } // function - initializeDashboard

}
