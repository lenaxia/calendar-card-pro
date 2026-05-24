/* eslint-disable import/order */
/**
 * Calendar Card Pro
 *
 * A sleek and highly customizable calendar card for Home Assistant,
 * designed for performance and a clean, modern look.
 *
 * @author Alex Pfau
 * @license MIT
 * @version vPLACEHOLDER
 *
 * Project Home: https://github.com/alexpfau/calendar-card-pro
 * Documentation: https://github.com/alexpfau/calendar-card-pro/blob/main/README.md
 *
 * Design inspired by Home Assistant community member @GHA_Steph's button-card calendar design
 * https://community.home-assistant.io/t/calendar-add-on-some-calendar-designs/385790
 *
 * Interaction patterns inspired by Home Assistant's Tile Card
 * and Material Design, both licensed under the Apache License 2.0.
 * https://github.com/home-assistant/frontend/blob/dev/LICENSE.md
 *
 * This package includes lit/LitElement (BSD-3-Clause License)
 */

// Import Lit libraries
import { LitElement, PropertyValues, TemplateResult, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

// Import all types via namespace for cleaner imports
import * as Config from './config/config';
import * as Constants from './config/constants';
import * as Types from './config/types';
import { NowLineController } from './controllers/now-line-controller';
import { ResponsiveColumnsController } from './controllers/responsive-columns-controller';
import * as Localize from './translations/localize';
import * as EventUtils from './utils/events';
import * as Actions from './interaction/actions';
import * as FormatUtils from './utils/format';
import * as Grid from './utils/grid';
import * as Helpers from './utils/helpers';
import * as Logger from './utils/logger';
import * as Styles from './rendering/styles';
import * as Feedback from './interaction/feedback';
import * as Render from './rendering/render';
import * as RenderGrid from './rendering/render-grid';
import * as Weather from './utils/weather';
import * as Editor from './rendering/editor';

//-----------------------------------------------------------------------------
// GLOBAL TYPE DECLARATIONS
//-----------------------------------------------------------------------------

// Ensure this file is treated as a module
export {};

// Add global type declarations
declare global {
  interface Window {
    customCards: Array<Types.CustomCard>;
  }

  interface HTMLElementTagNameMap {
    'calendar-card-pro-dev': CalendarCardPro;
    'calendar-card-pro-dev-editor': Editor.CalendarCardProEditor;
    'ha-ripple': HTMLElement;
  }
}

//-----------------------------------------------------------------------------
// MAIN COMPONENT CLASS
//-----------------------------------------------------------------------------

/**
 * The main Calendar Card Pro component that extends LitElement
 * This class orchestrates the different modules to create a complete
 * calendar card for Home Assistant
 */
@customElement('calendar-card-pro-dev')
class CalendarCardPro extends LitElement {
  //-----------------------------------------------------------------------------
  // PROPERTIES
  //-----------------------------------------------------------------------------

  @property({ attribute: false }) hass?: Types.Hass;
  @property({ attribute: false }) config: Types.Config = { ...Config.DEFAULT_CONFIG };
  @property({ attribute: false }) events: Types.CalendarEventData[] = [];
  @property({ attribute: false }) isInitialLoad = true;
  @property({ attribute: false }) isLoading = false;
  @property({ attribute: false }) isExpanded = false;
  @property({ attribute: false }) viewOffsetDays = 0;
  @property({ attribute: false }) visibleDays: 1 | 3 | 7 = 7;
  @property({ attribute: false }) weatherForecasts: Types.WeatherForecasts = {
    daily: {},
    hourly: {},
  };
  @property({ attribute: false }) private _eventDetail: {
    summary: string;
    dtstart: string;
    dtend: string;
    location: string;
    description: string;
    entityId: string;
  } | null = null;

  /**
   * Static method that returns a new instance of the editor
   * This is how Home Assistant discovers and loads the editor
   */
  static getConfigElement() {
    return document.createElement('calendar-card-pro-dev-editor');
  }

  static getStubConfig = Config.getStubConfig;

  // Private, non-reactive properties
  private _instanceId = Helpers.generateInstanceId();
  private _language = '';
  private _refreshTimerId?: number;
  private _lastUpdateTime = 0;
  private _initialLoadRetryId?: number;
  private _weatherUnsubscribers: Array<() => void> = [];
  private _weatherSetupVersion = 0;
  private _weatherSetupPending = false;

  private readonly _responsiveColumns: ResponsiveColumnsController;
  private readonly _nowLine: NowLineController;

  // Interaction state
  private _activePointerId: number | null = null;
  private _holdTriggered = false;
  private _holdTimer: number | null = null;
  private _holdIndicator: HTMLElement | null = null;

  //-----------------------------------------------------------------------------
  // COMPUTED GETTERS
  //-----------------------------------------------------------------------------

  /**
   * Safe accessor for hass - always returns hass object or null
   */
  get safeHass(): Types.Hass | null {
    return this.hass || null;
  }

  /**
   * Get the effective language to use based on configuration and HA locale
   */
  get effectiveLanguage(): string {
    if (!this._language && this.hass) {
      this._language = Localize.getEffectiveLanguage(this.config.language, this.hass.locale);
    }
    return this._language || 'en';
  }

  /**
   * Get events grouped by day
   */
  get groupedEvents(): Types.EventsByDay[] {
    return EventUtils.groupEventsByDay(
      this.events,
      this.config,
      this.isExpanded,
      this.effectiveLanguage,
    );
  }

  //-----------------------------------------------------------------------------
  // STATIC PROPERTIES
  //-----------------------------------------------------------------------------

  static get styles() {
    return Styles.cardStyles;
  }

  //-----------------------------------------------------------------------------
  // LIFECYCLE METHODS
  //-----------------------------------------------------------------------------

  constructor() {
    super();
    this._instanceId = Helpers.generateInstanceId();
    Logger.initializeLogger(Constants.VERSION.CURRENT);

    // Time-grid view lifecycle controllers; activate only in time-grid view.
    this._responsiveColumns = new ResponsiveColumnsController(this);
    this._nowLine = new NowLineController(this);
  }

  /** @internal — required by ResponsiveColumnsController */
  onVisibleDaysChanged(): void {
    this._clampViewOffset();
  }

  /** @internal — required by NowLineController */
  get hostElement(): Element {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    Logger.debug('Component connected');

    // Set up refresh timer
    this.startRefreshTimer();

    // Load events on initial connection
    this.updateEvents();

    // Set up weather subscriptions if configured
    this._scheduleWeatherSetup();

    // Set up visibility listener
    document.addEventListener('visibilitychange', this._handleVisibilityChange);

    // Listen for grid event detail requests
    this.addEventListener(
      'ccp-show-event-detail',
      ((e: CustomEvent) => {
        this._eventDetail = e.detail;
      }) as EventListener,
    );

    // Time-grid controllers (_responsiveColumns, _nowLine) self-register via
    // hostConnected — no explicit setup needed here.
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    // Invalidate any in-flight or pending weather subscription setup
    this._weatherSetupVersion++;
    this._weatherSetupPending = false;

    // Clean up weather subscriptions
    this._cleanupWeatherSubscriptions();

    // Clean up timers
    if (this._refreshTimerId) {
      clearTimeout(this._refreshTimerId);
    }

    if (this._initialLoadRetryId) {
      clearTimeout(this._initialLoadRetryId);
      this._initialLoadRetryId = undefined;
    }

    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }

    // Clean up hold indicator if it exists
    if (this._holdIndicator) {
      Feedback.removeHoldIndicator(this._holdIndicator);
      this._holdIndicator = null;
    }

    // Remove listeners
    document.removeEventListener('visibilitychange', this._handleVisibilityChange);

    Logger.debug('Component disconnected');
  }

  updated(changedProps: PropertyValues) {
    // If hass becomes available after initial connection, load events immediately
    if (changedProps.has('hass') && this.hass && !changedProps.get('hass')) {
      this.updateEvents(true);
    }

    // Update language if locale or config language changed
    if (
      (changedProps.has('hass') && this.hass?.locale) ||
      (changedProps.has('config') && changedProps.get('config')?.language !== this.config.language)
    ) {
      this._language = Localize.getEffectiveLanguage(this.config.language, this.hass?.locale);
    }

    // Set up weather subscriptions when hass becomes available or weather config changes
    const hassJustAvailable = changedProps.has('hass') && this.hass && !changedProps.get('hass');
    const prevConfig = changedProps.get('config') as Types.Config | undefined;
    const weatherConfigChanged =
      changedProps.has('config') &&
      (this.config?.weather?.entity !== prevConfig?.weather?.entity ||
        this.config?.weather?.position !== prevConfig?.weather?.position);

    if (hassJustAvailable || weatherConfigChanged) {
      this._scheduleWeatherSetup();
    }

    if (changedProps.has('config')) {
      // Controllers handle their own observer/interval state via hostUpdated;
      // host only does cross-controller orchestration here.
      if (prevConfig?.view !== this.config.view) {
        this.viewOffsetDays = 0;
      } else if (
        prevConfig &&
        prevConfig.time_grid_navigation_days !== this.config.time_grid_navigation_days
      ) {
        this._clampViewOffset();
      }
    }
  }

  //-----------------------------------------------------------------------------
  // PRIVATE METHODS
  //-----------------------------------------------------------------------------

  /**
   * Generate style properties from configuration
   * Returns a style object for use with styleMap
   */
  private getCustomStyles(): Record<string, string> {
    // Convert CSS custom properties to a style object
    return Styles.generateCustomPropertiesObject(this.config);
  }

  /**
   * Handle visibility changes to refresh data when returning to the page.
   * The NowLine controller has its own visibilitychange listener for tick
   * pause/resume; the host listener handles the data-refresh and the
   * "remeasure columns after a long hide" cases.
   */
  private _handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      if (now - this._lastUpdateTime > Constants.TIMING.VISIBILITY_REFRESH_THRESHOLD) {
        Logger.debug('Visibility changed to visible, updating events');
        this.updateEvents();
      }
      // The host may have been resized while hidden; ResizeObserver may not
      // fire on hidden→visible if the dimensions did not actually change.
      // Force a measurement pass so visibleDays reflects current width.
      this._responsiveColumns.remeasure();
    }
  };

  /**
   * Start the refresh timer
   */
  private startRefreshTimer() {
    if (this._refreshTimerId) {
      clearTimeout(this._refreshTimerId);
    }

    const refreshMinutes =
      this.config.refresh_interval || Constants.CACHE.DEFAULT_DATA_REFRESH_MINUTES;
    const refreshMs = refreshMinutes * 60 * 1000;

    this._refreshTimerId = window.setTimeout(() => {
      this.updateEvents();
      this.startRefreshTimer();
    }, refreshMs);

    Logger.debug(`Scheduled next refresh in ${refreshMinutes} minutes`);
  }

  /**
   * Schedule weather subscription setup, debounced to collapse multiple calls
   * within the same microtask into a single setup.
   */
  private _scheduleWeatherSetup(): void {
    if (this._weatherSetupPending) return;
    this._weatherSetupPending = true;
    queueMicrotask(() => {
      this._weatherSetupPending = false;
      if (!this.isConnected) return;
      this._setupWeatherSubscriptions();
    });
  }

  /**
   * Set up weather forecast subscriptions
   */
  private async _setupWeatherSubscriptions(): Promise<void> {
    // Increment version to invalidate any in-flight setup from a previous call
    const version = ++this._weatherSetupVersion;

    // Clean up existing subscriptions
    this._cleanupWeatherSubscriptions();

    // Skip if no weather configuration or no entity
    if (!this.config?.weather?.entity || !this.hass) {
      return;
    }

    // Determine which forecast types to subscribe to
    const forecastTypes = Weather.getRequiredForecastTypes(this.config.weather);

    // Subscribe to each required forecast type
    for (const type of forecastTypes) {
      // If a newer setup call was initiated, abandon this one
      if (this._weatherSetupVersion !== version) {
        return;
      }

      const unsubscribe = await Weather.subscribeToWeatherForecast(
        this.hass!,
        this.config,
        type,
        (forecasts) => {
          // Update the appropriate forecast type
          this.weatherForecasts = {
            ...this.weatherForecasts,
            [type]: forecasts,
          };
          this.requestUpdate();
        },
      );

      // Check again after await — a newer call may have superseded this one
      if (this._weatherSetupVersion !== version) {
        if (unsubscribe) unsubscribe();
        return;
      }

      if (unsubscribe) {
        this._weatherUnsubscribers.push(unsubscribe);
      }
    }
  }

  /**
   * Clean up weather subscriptions
   */
  private _cleanupWeatherSubscriptions(): void {
    const count = this._weatherUnsubscribers.length;
    if (count > 0) {
      Logger.debug(`Unsubscribing ${count} weather forecast subscription(s)`);
    }
    this._weatherUnsubscribers.forEach((unsubscribe) => {
      try {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch (error) {
        Logger.warn('Failed to unsubscribe weather forecast', error);
      }
    });
    this._weatherUnsubscribers = [];
  }

  private _maxOffset(): number {
    return Math.max(0, this.config.time_grid_navigation_days - this.visibleDays);
  }

  private _clampViewOffset(): void {
    const max = this._maxOffset();
    if (this.viewOffsetDays > max) {
      this.viewOffsetDays = max;
    } else if (this.viewOffsetDays < 0) {
      this.viewOffsetDays = 0;
    }
  }

  private _shiftDays(delta: number): void {
    this.viewOffsetDays = Grid.clampOffset(this.viewOffsetDays, delta, this._maxOffset());
  }

  private _todayOffset(): number {
    const reference = Grid.getReferenceDate(this.config);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDayOfWeek = FormatUtils.getFirstDayOfWeek(
      this.config.first_day_of_week,
      this.effectiveLanguage,
    );
    return Grid.computeTodayOffset(
      reference,
      today,
      this.visibleDays,
      this.config.time_grid_navigation_days,
      firstDayOfWeek,
    );
  }

  /**
   * Handle pointer down events for hold detection
   */
  private _handlePointerDown(ev: PointerEvent) {
    // Store this pointer ID to track if it's the same pointer throughout
    this._activePointerId = ev.pointerId;
    this._holdTriggered = false;

    // Only set up hold timer if hold action is configured
    if (this.config.hold_action?.action !== 'none') {
      // Clear any existing timer
      if (this._holdTimer) {
        clearTimeout(this._holdTimer);
      }

      // Start a new hold timer
      this._holdTimer = window.setTimeout(() => {
        if (this._activePointerId === ev.pointerId) {
          this._holdTriggered = true;

          // Create hold indicator for visual feedback
          this._holdIndicator = Feedback.createHoldIndicator(ev, this.config);
        }
      }, Constants.TIMING.HOLD_THRESHOLD);
    }
  }

  /**
   * Handle pointer up events to execute actions
   */
  private _handlePointerUp(ev: PointerEvent) {
    // Only process if this is the pointer we've been tracking
    if (ev.pointerId !== this._activePointerId) return;

    // Clear hold timer
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }

    // Execute the appropriate action based on whether hold was triggered
    if (this._holdTriggered && this.config.hold_action) {
      Logger.debug('Executing hold action');
      Actions.handleAction(this, this.config, 'hold', () => this.toggleExpanded());
    } else if (!this._holdTriggered && this.config.tap_action) {
      Logger.debug('Executing tap action');
      Actions.handleAction(this, this.config, 'tap', () => this.toggleExpanded());
    }

    // Reset state
    this._activePointerId = null;
    this._holdTriggered = false;

    // Remove hold indicator if it exists
    if (this._holdIndicator) {
      Feedback.removeHoldIndicator(this._holdIndicator);
      this._holdIndicator = null;
    }
  }

  /**
   * Handle pointer cancel/leave events to clean up
   */
  private _handlePointerCancel() {
    // Clear hold timer
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }

    // Reset state
    this._activePointerId = null;
    this._holdTriggered = false;

    // Remove hold indicator if it exists
    if (this._holdIndicator) {
      Feedback.removeHoldIndicator(this._holdIndicator);
      this._holdIndicator = null;
    }
  }

  /**
   * Handle keyboard navigation for accessibility
   */
  private _handleKeyDown(ev: KeyboardEvent) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      Actions.handleAction(this, this.config, 'tap', () => this.toggleExpanded());
    }
  }

  //-----------------------------------------------------------------------------
  // PUBLIC METHODS
  //-----------------------------------------------------------------------------

  /**
   * Handle configuration updates from Home Assistant
   */
  setConfig(config: Partial<Types.Config>): void {
    const previousConfig = this.config;

    // First do the standard merging
    let mergedConfig = { ...Config.DEFAULT_CONFIG, ...config };

    //============================================================================
    // END OF DEPRECATED PARAMETERS HANDLING
    //============================================================================

    // Coerce invalid time-grid config to safe defaults so downstream consumers
    // (instanceId, hasConfigChanged, render dispatch) only see valid values.
    Config.validateTimeGridConfig(mergedConfig);

    this.config = mergedConfig;
    this.config.entities = Config.normalizeEntities(this.config.entities);

    // Generate deterministic ID for caching
    this._instanceId = Helpers.generateDeterministicId(
      this.config.entities,
      this.config.days_to_show,
      this.config.show_past_events,
      this.config.start_date,
    );

    // Check if we need to reload data
    const configChanged = Config.hasConfigChanged(previousConfig, this.config);
    if (configChanged) {
      Logger.debug('Configuration changed, refreshing data');
      this.updateEvents(true);
    }

    // Restart the timer with new config
    this.startRefreshTimer();
  }

  /**
   * Approximate card size for Home Assistant's masonry view (in 50px-row units).
   * List view returns 1 (HA's documented default); time-grid view returns the
   * height of the visible band plus a small chrome allowance, optionally
   * clamped to a px-valued `max_height`.
   */
  public getCardSize(): number {
    return Grid.computeCardSize(this.config);
  }

  /**
   * Update calendar events from API or cache
   * Simplified for card-mod compatibility
   */
  async updateEvents(force = false): Promise<void> {
    Logger.debug(`Updating events (force=${force})`);

    // Skip update if no Home Assistant connection or no entities
    if (!this.safeHass || !this.config.entities.length) {
      this.isLoading = false;
      if (!this.safeHass) {
        // Retry shortly to handle hass initialization timing
        if (this._initialLoadRetryId) {
          clearTimeout(this._initialLoadRetryId);
        }
        this._initialLoadRetryId = window.setTimeout(() => {
          this.updateEvents(true);
        }, 1500);
      }
      return;
    }

    try {
      // Signal loading — initial load shows loading screen; background refresh shows spinner
      this.isLoading = true;
      await this.updateComplete;

      // Get event data (from cache or API) using modularized function.
      // For grid view: (1) widen fetch range backward by 7 days so the visible
      // window is always covered after week alignment (Bug #1, worklog 0020);
      // (2) disable split_multiday_events globally + per-entity so the grid
      // renderer's own midnight-aware split runs on whole timed events,
      // avoiding the synthetic-all-day-middle-day banner artifact (Bug #4).
      let fetchConfig = this.config;
      let effectiveDays: number | undefined;
      if (this.config.view === 'time-grid') {
        fetchConfig = Grid.buildGridFetchConfig(this.config);
        effectiveDays = Grid.computeGridFetchRange(this.config).daysToShow;
      }
      const eventData = await EventUtils.fetchEventData(
        this.safeHass,
        fetchConfig,
        this._instanceId,
        force,
        effectiveDays,
      );

      this.isLoading = false;
      this.isInitialLoad = false;
      await this.updateComplete;

      // Finally set events data
      this.events = [...eventData];
      this._lastUpdateTime = Date.now();

      Logger.info('Event update completed successfully');
    } catch (error) {
      Logger.error('Failed to update events:', error);
      this.isLoading = false;
      this.isInitialLoad = false;
    }
  }

  /**
   * Toggle expanded state for view modes with limited events
   */
  toggleExpanded(): void {
    if (this.config.compact_events_to_show || this.config.compact_days_to_show) {
      this.isExpanded = !this.isExpanded;
    }
  }

  /**
   * Handle user action
   */
  handleAction(actionConfig: Types.ActionConfig): void {
    // Determine action type based on which config matches
    const action = actionConfig === this.config.hold_action ? 'hold' : 'tap';
    Actions.handleAction(this, this.config, action, () => this.toggleExpanded());
  }

  //-----------------------------------------------------------------------------
  // RENDERING
  //-----------------------------------------------------------------------------

  /**
   * Render method with consistent, stable DOM structure for card-mod
   */
  render() {
    const customStyles = this.getCustomStyles();
    const isGridView = this.config.view === 'time-grid';

    // Create event handlers object for the card
    // Grid view has its own nav buttons; disable card-level tap/hold
    const noop = () => {};
    const handlers = isGridView
      ? {
          keyDown: noop as unknown as (ev: KeyboardEvent) => void,
          pointerDown: noop as unknown as (ev: PointerEvent) => void,
          pointerUp: noop as unknown as (ev: PointerEvent) => void,
          pointerCancel: noop as unknown as (ev: Event) => void,
          pointerLeave: noop as unknown as (ev: Event) => void,
        }
      : {
          keyDown: (ev: KeyboardEvent) => this._handleKeyDown(ev),
          pointerDown: (ev: PointerEvent) => this._handlePointerDown(ev),
          pointerUp: (ev: PointerEvent) => this._handlePointerUp(ev),
          pointerCancel: () => this._handlePointerCancel(),
          pointerLeave: () => this._handlePointerCancel(),
        };

    // Determine card content based on state
    let content: TemplateResult;

    if (this.isInitialLoad) {
      // Initial load — no data yet, show minimal loading screen
      content = Render.renderCardContent('loading', this.effectiveLanguage);
    } else if (!this.safeHass || !this.config.entities.length) {
      // Error state - missing entities
      content = Render.renderCardContent('error', this.effectiveLanguage);
    } else {
      content = this._renderView(this.config.view);
    }

    // Append event detail overlay if active
    if (this._eventDetail) {
      const d = this._eventDetail;
      const startStr = d.dtstart
        ? new Date(d.dtstart).toLocaleString(undefined, {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : '';
      const endStr = d.dtend
        ? new Date(d.dtend).toLocaleString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
          })
        : '';
      const close = () => {
        this._eventDetail = null;
      };
      content = html`${content}
        <div
          class="ccp-event-overlay"
          @click=${close}
          @pointerdown=${(e: Event) => e.stopPropagation()}
        >
          <div class="ccp-event-detail" @click=${(e: Event) => e.stopPropagation()}>
            <div class="ccp-event-detail-header">
              <span class="ccp-event-detail-title">${d.summary}</span>
              <button class="ccp-event-detail-close" @click=${close}>✕</button>
            </div>
            ${startStr
              ? html`<div class="ccp-event-detail-row">
                  <ha-icon icon="mdi:clock-outline"></ha-icon>
                  <span>${startStr}${endStr ? ` – ${endStr}` : ''}</span>
                </div>`
              : ''}
            ${d.location
              ? html`<div class="ccp-event-detail-row">
                  <ha-icon icon="mdi:map-marker-outline"></ha-icon>
                  <span>${d.location}</span>
                </div>`
              : ''}
            ${d.description
              ? html`<div class="ccp-event-detail-row ccp-event-detail-desc">
                  <ha-icon icon="mdi:information-outline"></ha-icon>
                  <span>${d.description}</span>
                </div>`
              : ''}
          </div>
        </div>
      `;
    }

    // Render main card structure with content
    return Render.renderMainCardStructure(
      customStyles,
      this.config.title,
      content,
      handlers,
      false,
      this.isLoading,
      isGridView,
    );
  }

  /**
   * Dispatch on the view discriminator. The `never` fallthrough makes adding a
   * new variant to `Config['view']` a TypeScript compile error here, preventing
   * silent regressions like a future `'month-grid'` falling through to the list
   * renderer (E-3).
   */
  private _renderView(view: Types.Config['view']): TemplateResult {
    switch (view) {
      case 'list':
        return this._renderListView();
      case 'time-grid':
        return this._renderTimeGridView();
      default: {
        const _exhaustive: never = view;
        throw new Error(`Unhandled view variant: ${String(_exhaustive)}`);
      }
    }
  }

  private _renderListView(): TemplateResult {
    if (this.events.length === 0) {
      const groupedEmptyDays = EventUtils.groupEventsByDay(
        [],
        this.config,
        this.isExpanded,
        this.effectiveLanguage,
      );
      return Render.renderGroupedEvents(
        groupedEmptyDays,
        this.config,
        this.effectiveLanguage,
        this.weatherForecasts,
        this.safeHass,
      );
    }
    return Render.renderGroupedEvents(
      this.groupedEvents,
      this.config,
      this.effectiveLanguage,
      this.weatherForecasts,
      this.safeHass,
    );
  }

  private _renderTimeGridView(): TemplateResult {
    return RenderGrid.renderTimeGrid(
      this.events,
      this.config,
      this.effectiveLanguage,
      {
        visibleDays: this.visibleDays,
        offsetDays: this.viewOffsetDays,
        now: this._nowLine.now,
        onShiftDay: (d) => this._shiftDays(d),
        onShiftWindow: (d) => this._shiftDays(d * this.visibleDays),
        onResetToToday: () => {
          this.viewOffsetDays = this._todayOffset();
        },
        canShiftBack: this.viewOffsetDays > 0,
        canShiftForward: this.viewOffsetDays < this._maxOffset(),
      },
      this.safeHass,
    );
  }
}

//-----------------------------------------------------------------------------
// ELEMENT REGISTRATION
//-----------------------------------------------------------------------------

// Register the editor - main component registered by decorator
customElements.define('calendar-card-pro-dev-editor', Editor.CalendarCardProEditor);

// Create interface extending CustomElementConstructor to allow getStubConfig property
interface CalendarCardConstructor extends CustomElementConstructor {
  getStubConfig?: typeof Config.getStubConfig;
}

// Expose getStubConfig for Home Assistant card picker preview
const element = customElements.get('calendar-card-pro-dev');
if (element) {
  (element as CalendarCardConstructor).getStubConfig = Config.getStubConfig;
}

// Register with HACS
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'calendar-card-pro-dev',
  name: 'Calendar Card Pro',
  preview: true,
  description: 'A calendar card that supports multiple calendars with individual styling.',
  documentationURL: 'https://github.com/alexpfau/calendar-card-pro',
});
