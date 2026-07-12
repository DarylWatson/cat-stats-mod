/**
 * Implementation of [[Cat Stats Tool]].
 */
$(document).ready(async function () {
	window.dev = window.dev || {};
	if (window.dev.CatStatsToolLoaded || !document.getElementById('cat-stats-tool__loading')) {
		return;
	}
	window.dev.CatStatsToolLoaded = true;
	// prevent double loading

	mw.loader.load('https://cdn.jsdelivr.net/npm/chart.js');
	mw.loader.load('https://cdn.jsdelivr.net/npm/chartjs-plugin-colorschemes');
	// mw.loader.load("ext.gadget.CatStatsTool");

	const pages = [
		'MediaWiki:Custom-CatData.json',
		'MediaWiki:Custom-AbilityExplanations.json',
		'MediaWiki:Custom-TalentData.json',
		'MediaWiki:Custom-UltraTalentData.json',
		'MediaWiki:Custom-FilterOptions.json',
		'Template:FilterIconInfo/CatData.json',
		'Module:Lineup/combos2.json',
	];

	function getDataQuery([data]) {
		const map = new Map();
		for (const page of data.query.pages) {
			map.set(page.title, page.revisions[0].slots.main.content);
		}

		return map;
	}

	// string formatting method for ability explanations
	function formatString(s, args) {
		return s.replace(/{(\d+)}/g, function (match, number) {
			return typeof args[number] != 'undefined' ? args[number] : match;
		});
	}

	// base 64 for query string compressing
	const RIXITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
	const Base64 = {
		fromNumber: function (number) {
			let rixit;
			let residual = Math.floor(number);
			let result = '';
			while (true) {
				rixit = residual % 64;
				result = RIXITS.charAt(rixit) + result;
				residual = Math.floor(residual / 64);
				if (residual == 0) break;
			}
			return result;
		},

		toNumber: function (rixits) {
			let result = 0;
			rixits = rixits.split('');
			for (let e = 0; e < rixits.length; e++) {
				result = (result * 64) + RIXITS.indexOf(rixits[e]);
			}
			return result;
		}
	};

	function init(map) {
		const data_FilterIconInfo_CatData = JSON.parse(map.get('Template:FilterIconInfo/CatData.json'));
		const data_CatData = JSON.parse(map.get('MediaWiki:Custom-CatData.json'));
		const data_AbilityExplanations = JSON.parse(map.get('MediaWiki:Custom-AbilityExplanations.json'));
		const data_TalentData = JSON.parse(map.get('MediaWiki:Custom-TalentData.json'));
		const data_UltraTalentData = JSON.parse(map.get('MediaWiki:Custom-UltraTalentData.json'));
		const data_FilterOptions = JSON.parse(map.get('MediaWiki:Custom-FilterOptions.json'));
		const data_Lineup_Combos = JSON.parse(map.get('Module:Lineup/combos2.json'));

		const maxSearchResults = 5;
		const initialDefaultLevel = '30';
		const decimalPoints = 2;
		const multiOverlapThreshold = 5;
		const rowIconSize = 25;
		const rowsPerPage = 500;
		const mobileControls = window.matchMedia('(hover: none)').matches;
		const mobileThreshold = 425;
		const copyPopupLength = 1500;
		const doubleTapLength = 500;
		let doubleTapped = false;
		let overSearchList = false;
		let currentPage = 0;
		let catCounter = 0;
		let noSelection = true;
		let $dragRow;
		const filterableStats = {
			"hp": "HP",
			"ap": "Damage",
			"freq": "Cycle",
			"rng": "Range",
			"spd": "Speed",
			"kb": "Knockbacks",
			"rech": "Recharge",
			"cost": "Cost"
		};
		const headerNames = [
			"Copy Link",
			"",
			"Name",
			"Health",
			"Health<sup>Avg</sup>",
			"Health<sup>Max</sup>",
			"Attack",
			"Attack<sup>Avg</sup>",
			"Attack<sup>Max</sup>",
			"DPS",
			"DPS<sup>Avg</sup>",
			"DPS<sup>Max</sup>",
			"Attack Cycle",
			"Foreswing",
			"Backswing",
			"Attack Cooldown",
			"Range",
			"Speed",
			"Knockbacks",
			"Recharge",
			"Cost",
			"Attack Type",
			"Targets",
			"",
			"Effects",
			"Abilities",
			"Talent Orb",
			""
		];
		const toggleableColumns = {
			"Name": "name",
			"Health": "hp",
			"Health<sup>Avg</sup>": "hpExp",
			"Health<sup>Max</sup>": "hpMax",
			"Attack": "atk",
			"Attack<sup>Avg</sup>": "atkExp",
			"Attack<sup>Max</sup>": "atkMax",
			"DPS": "dps",
			"DPS<sup>Avg</sup>": "dpsExp",
			"DPS<sup>Max</sup>": "dpsMax",
			"Attack Cycle": "frequency",
			"Foreswing": "foreswing",
			"Backswing": "backswing",
			"Attack Cooldown": "tba",
			"Range": "range",
			"Speed": "speed",
			"Knockbacks": "knockbacks",
			"Recharge": "recharge",
			"Cost": "cost",
			"Attack Type": "type"
		};
		const hiddenColumns = new Set([
			"hp",
			"hpMax",
			"atk",
			"atkMax",
			"dps",
			"dpsMax"
		]);
		const hiddenMobileColumns = new Set([
			"foreswing",
			"backswing",
			"tba",
			"cost"
		]);
		const traitIcons = {
			"red": "https://static.wikitide.net/battlecatswiki/6/62/Redtraiticon.png",
			"floating": "https://static.wikitide.net/battlecatswiki/7/79/Floatingtraiticon.png",
			"dark": "https://static.wikitide.net/battlecatswiki/5/52/Darktraiticon.png",
			"metal": "https://static.wikitide.net/battlecatswiki/d/df/Metaltraiticon.png",
			"angel": "https://static.wikitide.net/battlecatswiki/6/60/Angeltraiticon.png",
			"alien": "https://static.wikitide.net/battlecatswiki/7/72/Alientraiticon.png",
			"zombie": "https://static.wikitide.net/battlecatswiki/0/06/Zombietraiticon.png",
			"relic": "https://static.wikitide.net/battlecatswiki/d/d0/Relictraiticon.png",
			"aku": "https://static.wikitide.net/battlecatswiki/9/96/Akutraiticon.png",
			"traitless": "https://static.wikitide.net/battlecatswiki/1/1a/Traitlesstraiticon.png"
		};
		const traitList = Object.keys(traitIcons);
		let $traits;
		{
			let result = [];
			for (const t of traitList) {
				const $iconWrapper = $('<div>')
					.addClass(`cat-stats-tool__trait-icon-wrapper`);
				const $traitInput = $('<input>')
					.attr({
						'type': 'checkbox',
						'value': t
					})
					.appendTo($iconWrapper);
				$('<img>')
					.addClass(`cat-stats-tool__trait-icon`)
					.attr({
						'src': traitIcons[t],
						'width': rowIconSize,
						'height': rowIconSize
					})
					.appendTo($iconWrapper);
				$('<div></div>').appendTo($iconWrapper);
				result.push($iconWrapper);
			}
			$traits = result;
		}
		const fruitTraits = [
			"red",
			"floating",
			"dark",
			"metal",
			"angel",
			"alien",
			"zombie"
		];
		const nonFruitTraits = [
			"traitless",
			"relic",
			"aku"
		];
		const effects = [
			"strong",
			"knockback",
			"freeze",
			"slow",
			"resistant",
			"massive-damage",
			"attacks-only",
			"weaken",
			"insanely-tough",
			"insane-damage",
			"dodge",
			"curse"
		];
		const durationAbilities = [
			"freeze",
			"slow",
			"weaken",
			"curse"
		];
		const toggleableAbilities = {
			"strengthen": false,
			"colossus-slayer": false,
			"behemoth-slayer": false,
			"sage-slayer": false,
			"wave": true,
			"mini-wave": true,
			"surge": true,
			"mini-surge": true,
			"explosion": true
		};
		const orbEffects = ['attack', 'defense', 'strong', 'massive', 'resist', 'colossus', 'sol'];
		const orbGrades = ['d', 'c', 'b', 'a', 's'];
		const orbColHPMod = [0, 0.05, 0.1, 0.15, 0.2, 0.3];
		const orbColAPMod = [0, 0.05, 0.1, 0.25, 0.4, 0.6];
		const orbSolMultipliers = [1, 1.05, 1.1, 1.2, 1.3, 1.5];
		const comboEffects = {
			"Unit Attack UP": 'Attack',
			"Unit Defense UP": 'Defense',
			"Unit Speed UP": 'Speed',
			"Research Power UP": 'Research',
			'"Strong" Effect UP': 'Strong',
			'"Massive Damage" Effect UP': 'Massive Damage',
			'"Resistant" Effect UP': 'Resistant',
			'"Slow Effect UP"': 'Slow',
			'"Freeze" Effect UP': 'Freeze',
			'"Weaken" Effect UP': 'Weaken',
			'"Strengthen" Effect UP': 'Strengthen',
			'"Critical Chance UP': 'Critical'
		};
		const comboSizes = ['Sm', 'M', 'L'];
		const comboNums = {
			'Attack': [0.1, 0.15, 0.2],
			'Defense': [0.1, 0.2, 0.3],
			'Speed': [0.1, 0.15, 0.2],
			'Research': [26, 52, 79],
			'Strong': [0.1, 0.2, 0.3],
			'Massive Damage': [0.1, 0.2, 0.3],
			'Resistant': [0.1, 0.2, 0.3],
			'Slow': [0.1, 0.2, 0.3],
			'Freeze': [0.1, 0.2, 0.3],
			'Weaken': [0.1, 0.2, 0.3],
			'Strengthen': [20, 30, 50],
			'Critical': [1, 2, 3]
		};
		const urlParams = new URLSearchParams(window.location.search);
		const compressionBits = [
			10, // cro
			2, // form
			8, // level
			4, // trait
			1, 1, 1, 1, 1, 1, 1, 1, 1, // ability toggles
			2, // talent mode
			3, 3, 3, 3 // orb parameters
		];

		// search bar
		const $topBar = $('#cat-stats-tool__top');
		const $searchContainer = $('#cat-stats-tool__search-container');
		const $addCat = $('<input>')
			.addClass('cat-stats-tool__input')
			.attr({
				'id': 'cat-stats-tool__add-cat',
				'type': 'text',
				'placeholder': 'Search to add Cats'
			})
			.appendTo($searchContainer);
		const $searchList = $('<ul>')
			.addClass('cat-stats-tool__search-list')
			.appendTo($searchContainer)
			.on({
				'mouseenter': function () { overSearchList = true; },
				'mouseleave': function () { overSearchList = false; }
			});
		let arrowSelect = -1;
		let searchLength = maxSearchResults;
		$addCat.on({
			'focus': function () {
				$searchList.addClass('cat-stats-tool__search-open');
			},
			'blur': function () {
				if (overSearchList) {
					$(this).focus();
					return;
				}
				$searchList.removeClass('cat-stats-tool__search-open');
			},
			'keydown': function (e) {
				switch (e.which) {
					case 38: // up arrow
						e.preventDefault();
						arrowSelect--;
						if (arrowSelect < 0) arrowSelect = 0;
						$('.cat-stats-tool__search-list .cat-stats-tool__search-item').removeClass('arrow-select');
						$(`.cat-stats-tool__search-list .cat-stats-tool__search-item:nth(${arrowSelect})`).addClass('arrow-select');
						break;
					case 40: // down arrow
						e.preventDefault();
						arrowSelect++;
						if (arrowSelect > searchLength - 1) arrowSelect = searchLength - 1;
						$('.cat-stats-tool__search-list .cat-stats-tool__search-item').removeClass('arrow-select');
						$(`.cat-stats-tool__search-list .cat-stats-tool__search-item:nth(${arrowSelect})`).addClass('arrow-select');
						break;
					case 13: // enter
						$('.cat-stats-tool__search-list .cat-stats-tool__search-item.arrow-select').trigger('click');
						break;
					case 27: // escape
						overSearchList = false;
						$(this).blur();
						break;
					default:
						arrowSelect = -1;
				}
			}
		});

		// top area inputs and buttons
		const $defaultLevel = $('<input>')
			.addClass('cat-stats-tool__input')
			.attr({
				'id': 'cat-stats-tool__default-level',
				'type': 'text',
				'placeholder': 'Default Level'
			})
			.appendTo($('#cat-stats-tool__default-level-container'))
			.on('input', function () {
				$(this).val($(this).val().replace(/[^0-9+]/g, ""));
			});
		const $addAll = $('<button>')
			.addClass('cat-stats-tool__button')
			.attr('id', 'cat-stats-tool__add-all')
			.text('Add All')
			.appendTo($('#cat-stats-tool__all-button-container'));
		const $filterOptions = $('<button>')
			.addClass('cat-stats-tool__button')
			.attr('id', 'cat-stats-tool__show-filter')
			.appendTo($('#cat-stats-tool__all-button-container'))
			.on('click', () => {
				$('#cat-stats-tool__filter').toggleClass('expanded');
				$filterOptions.toggleClass('expanded');
			});
		const $clearCats = $('<button>')
			.addClass('cat-stats-tool__button')
			.attr('id', 'cat-stats-tool__clear-all')
			.text('Clear')
			.appendTo($('#cat-stats-tool__clear-button-container'));

		// add filter options
		let filters = {
			'rarity': [new Set([]), new Set([])],
			'target': [new Set([]), new Set([]), new Set([]), new Set([])],
			'ability': [new Set([]), new Set([]), new Set([]), new Set([])],
			'form': [new Set([]), new Set([])],
			'maxForm': false,
			'talent': 0,
			'normal': true,
			'talents': false,
			'ultra': false
		};
		for (const stat in filterableStats) {
			filters[stat] = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
		}
		for (const section in data_FilterOptions) {
			for (const entry of data_FilterOptions[section]) {
				const $filterOption = $('<div>')
					.addClass('filter-icon');
				const $filterIcon = $('<img>')
					.attr({
						'src': entry[1],
						'loading': 'lazy'
					})
					.appendTo($filterOption);
				const $filterButton = $('<button>')
					.addClass('filter-icon')
					.attr({
						'value': entry[0],
						'state': 0,
						'section': ['attack', 'effect', 'subtrait', 'immunity', 'talent'].includes(section) ? 'ability' : section
					})
					.appendTo($filterOption);
				$('<div>').appendTo($filterOption);
				$filterOption.appendTo($(`#filter-${section}`));
			}
		}
		$('.filter-icon > button').on('click', function () {
			const value = $(this).attr('value');
			const section = $(this).attr('section');
			const oldState = Number($(this).attr('state'));
			const newState = (Number($(this).attr('state')) + 1) % (section == 'rarity' || section == 'form' ? 2 : 4);
			$(this).attr('state', newState);
			filters[section][oldState].delete(value);
			filters[section][newState].add(value);
		});
		const $filterSettingsRow = $('#filter-settings');
		const $filterMaxForm = $('<input>')
			.attr({
				'id': 'filter-max-forms',
				'type': 'checkbox'
			})
			.on('change', function () {
				filters.maxForm = $(this).is(':checked');
			});
		$('<span>')
			.append($filterMaxForm, $('<label for="filter-max-forms">Only Max Forms</label>'))
			.appendTo($filterSettingsRow);
		$filterSettingsRow.append('<br>');
		const $filterTalentsRadio = $('<input>')
			.attr({
				'type': 'radio',
				'name': 'filter-talent-radio'
			});
		const $filterNoTalents = $filterTalentsRadio
			.clone()
			.attr({
				'id': 'filter-no-talents',
				'value': 1
			});
		$('<span>')
			.append($filterNoTalents, $('<label for="filter-no-talents">No Talents</label>'))
			.appendTo($filterSettingsRow);
		const $filterHasTalents = $filterTalentsRadio
			.clone()
			.attr({
				'id': 'filter-has-talents',
				'value': 2
			});
		$('<span>')
			.append($filterHasTalents, $('<label for="filter-has-talents">Has Talents</label>'))
			.appendTo($filterSettingsRow);
		const $filterHasUltraTalents = $filterTalentsRadio
			.clone()
			.attr({
				'id': 'filter-has-ultra-talents',
				'value': 3
			});
		$('<span>')
			.append($filterHasUltraTalents, $('<label for="filter-has-ultra-talents">Has Ultra Talents</label>'))
			.appendTo($filterSettingsRow);
		$('input[name="filter-talent-radio"]').on('click', function (e) {
			if (filters.talent == $(this).val()) {
				$(this).prop('checked', false);
				filters.talent = 0;
			} else {
				filters.talent = $(this).val();
			}
		});
		$filterSettingsRow.append('<br>');
		const $filterTalentsCheckbox = $('<input>')
			.addClass('filter-talent-inclusion')
			.attr('type', 'checkbox');
		const $filterIncludeNonTalents = $filterTalentsCheckbox
			.clone()
			.attr({
				'id': 'filter-include-non-talents',
				'value': 'normal'
			})
			.prop('checked', true);
		$('<span>')
			.append($filterIncludeNonTalents, $('<label for="filter-include-non-talents">Include Non-Talents</label>'))
			.appendTo($filterSettingsRow);
		const $filterIncludeTalents = $filterTalentsCheckbox
			.clone()
			.attr({
				'id': 'filter-include-talents',
				'value': 'talents'
			});
		$('<span>')
			.append($filterIncludeTalents, $('<label for="filter-include-talents">Include Talents</label>'))
			.appendTo($filterSettingsRow);
		const $filterIncludeUltraTalents = $filterTalentsCheckbox
			.clone()
			.attr({
				'id': 'filter-include-ultra-talents',
				'value': 'ultra'
			});
		$('<span>')
			.append($filterIncludeUltraTalents, $('<label for="filter-include-ultra-talents">Include Ultra Talents</label>'))
			.appendTo($filterSettingsRow);
		$('input.filter-talent-inclusion').on('click', function () {
			const bool = $(this).is(':checked');
			const value = $(this).val();
			filters[value] = bool;
			if (bool) {
				for (const unit of filterData) {
					if (value != 'normal' && (unit.form == '0' || unit.form == '1')) continue;
					for (const item of [...unit[value]]) {
						if (traitList.includes(item)) {
							unit.target.add(item);
						} else {
							unit.ability.add(item);
						}
					}
				}
			} else {
				for (const unit of filterData) {
					if (value != 'normal' && (unit.form == '0' || unit.form == '1')) continue;
					for (const item of [...unit[value]]) {
						if (traitList.includes(item)) {
							unit.target.delete(item);
						} else {
							unit.ability.delete(item);
						}
					}
				}
			}
		});
		const $filterStatsRow = $('#filter-stats');
		for (const stat in filterableStats) {
			const $lowerInput = $('<input>')
				.attr({
					'type': 'text',
					'stat': stat,
					'index': 0
				});
			const $statsText = $('<span>')
				.text(` ≤ ${filterableStats[stat]} ≤ `);
			const $upperInput = $('<input>')
				.attr({
					'type': 'text',
					'stat': stat,
					'index': 1
				});
			$('<span>')
				.addClass('filter-stats-inequality')
				.append($lowerInput, $statsText, $upperInput)
				.appendTo($filterStatsRow);
		}
		$('#filter-stats input').on({
			'input': function () {
				$(this).val($(this).val().replace(/[^0-9]/g, ""));
			},
			'change': function () {
				const newValue = $(this).val() == '' ? ($(this).attr('index') == '0' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY) : Number($(this).val());
				filters[$(this).attr('stat')][Number($(this).attr('index'))] = newValue;
			}
		});
		const $filterControlsRow = $('#filter-controls');
		const $filterSelect = $('<button>')
			.addClass('cat-stats-tool__button')
			.attr('id', 'filter-select-cats')
			.text('Select Cats')
			.appendTo($filterControlsRow)
			.on('click', function () {
				let allSelected = true;
				let noneSelected = true;
				for (const cat of catList) {
					if (matchesFilter(cat.index)) cat.select();
					if (cat.selected) noneSelected = false;
					if (!cat.selected) allSelected = false;
				}
				noSelection = noneSelected || allSelected;
			});
		const $filterSelectClear = $('<button>')
			.addClass('cat-stats-tool__button')
			.attr('id', 'filter-clear-selection')
			.text('Clear Selection')
			.appendTo($filterControlsRow)
			.on('click', function () {
				for (const cat of catList) {
					cat.unselect();
				}
				noSelection = true;
			});
		const $filterReset = $('<button>')
			.addClass('cat-stats-tool__button')
			.attr('id', 'filter-reset')
			.text('Reset Filter')
			.appendTo($filterControlsRow)
			.on('click', function () {
				$('#cat-stats-tool__filter-options button').attr('state', 0);
				$('#filter-settings input[type="radio"]').prop('checked', false);
				$('#filter-settings input[type="checkbox"]').prop('checked', false);
				$('#filter-include-non-talents').prop('checked', true);
				filters = {
					'rarity': [new Set([]), new Set([])],
					'target': [new Set([]), new Set([]), new Set([]), new Set([])],
					'ability': [new Set([]), new Set([]), new Set([]), new Set([])],
					'form': [new Set([]), new Set([])],
					'maxForm': false,
					'talent': 0,
					'normal': true,
					'talents': false,
					'ultra': false
				};
				for (const stat in filterableStats) {
					filters[stat] = [Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY];
				}
			});

		// make table
		const $tableContainer = $('#cat-stats-tool__table-container');
		const $resultsTable = $('<table>')
			.attr('id', 'cat-stats-tool__table')
			.prependTo($tableContainer);
		const $tableHeader = $('<thead>')
			.appendTo($resultsTable);
		const $tableHeaderRow = $('<tr>')
			.appendTo($tableHeader);
		for (const name of headerNames) {
			const $tableHeaderCell = $('<th>')
				.appendTo($tableHeaderRow);
			const $tableHeaderDiv = $('<div class="cat-stats-tool__header-div"></div>')
				.html(`<span class="cat-stats-tool__header-span">${name}</span>`)
				.appendTo($tableHeaderCell);
			if (name in toggleableColumns) {
				$tableHeaderCell.addClass(`cat-stats-tool__cell-${toggleableColumns[name]}`);
				const $tableHeaderSort = $('<span>')
					.addClass('cat-stats-tool__column-sort')
					.attr({
						'data-col': toggleableColumns[name],
						'data-state': 0
					})
					.appendTo($tableHeaderDiv);
			}
		}
		$(document).on('click', '.cat-stats-tool__header-span', function () {
			$(this).next().trigger('click');
		});
		$(document).on('click', '.cat-stats-tool__column-sort', function () {
			const colName = $(this).attr('data-col');
			let colState = Number($(this).attr('data-state'));
			colState = (colState + 1) % 3;
			$(this).attr('data-state', colState);
			if (colState == 0) {
				catList = catList.sort(function (a, b) {
					return Math.sign(a.order - b.order);
				});
			} else {
				catList = catList.sort(function (a, b) {
					let row1, row2;
					if (colState == 1) {
						[row1, row2] = [a.cellSortValues[colName], b.cellSortValues[colName]];
					} else {
						[row1, row2] = [b.cellSortValues[colName], a.cellSortValues[colName]];
					}
					if (!isNaN(row1)) {
						return Math.sign(Number(row2) - Number(row1));
					} else {
						return row1.localeCompare(row2);
					}
				});
			}
			showCurrentPage();
			cleanSpaces();
		});
		const $tableBody = $('<tbody>')
			.attr('id', 'cat-stats-tool__table-body')
			.html('<tr class="cat-stats-tool__table-space"></tr>')
			.appendTo($resultsTable);
		const $tableFooter = $('<tfoot>')
			.attr('id', 'cat-stats-tool__details')
			.appendTo($resultsTable);
		const $spaceRow = $('<tr class="cat-stats-tool__table-space"></tr>');

		// link generate button
		const $linkButton = $('<button>')
			.attr('id', 'cat-stats-tool__link-button')
			.appendTo($tableHeaderRow.find('th:first div'))
			.on('click', function () {
				const query = {};
				const list = [];
				for (const cat of catList.slice(0, rowsPerPage)) {
					list.push(cat.compress());
				}
				if (list.length > 0) query.cats = list.join('|');
				let comboStr = '';
				const comboEffectsShort = Object.keys(comboNums);
				for (const eff in combos) {
					for (const mag of combos[eff]) {
						comboStr += `${comboEffectsShort.indexOf(eff).toString(16)}${mag}`;
					}
				}
				if (comboStr.length > 0) query.combos = comboStr;
				if (foundationLevel > 0) query.base = foundationLevel;
				if ($.isEmptyObject(query)) return;
				const queries = [];
				for (const name in query) {
					queries.push(`${name}=${query[name]}`);
				}
				const newURL = `https://battlecats.miraheze.org/wiki/Cat_Stats_Tool?${queries.join('&')}`;
				history.replaceState({}, '', newURL);
				navigator.clipboard.writeText(newURL);
				$('#cat-stats-tool__table thead th:first-child .cat-stats-tool__header-div').addClass('copy-active');
				setTimeout(() => {
					$('#cat-stats-tool__table thead th:first-child .cat-stats-tool__header-div').removeClass('copy-active');
				}, copyPopupLength);
			});
		$('#cat-stats-tool__table thead th:first-child .cat-stats-tool__header-span').on('click', function () {
			$(this).next().trigger('click');
		});

		// orb menu
		const $orbFooter = $('<tfoot>')
			.attr('id', 'cat-stats-tool__orb-select')
			.hide()
			.appendTo($resultsTable);
		const $effectRadios = $('<div>')
			.addClass('cat-stats-tool__orb-effects')
			.appendTo($orbFooter);
		for (const effect of orbEffects) {
			$(`<label class="orb-effect-label effect-${effect}">`)
				.append($(`<input type="radio" name="orb-effect" value="${effect}"${orbEffects.indexOf(effect) == 0 ? ' checked' : ''}>`))
				.appendTo($effectRadios);
		}
		const $gradeRadios = $('<div>')
			.addClass('cat-stats-tool__orb-grades')
			.appendTo($orbFooter);
		for (const grade of orbGrades.toReversed()) {
			$(`<label class="orb-grade-label grade-${grade}">`)
				.append($(`<input type="radio" name="orb-grade" value="${grade}"${orbGrades.indexOf(grade) == 0 ? ' checked' : ''}>`))
				.appendTo($gradeRadios);
		}
		const $orbButtonWrapper = $('<div>')
			.addClass('cat-stats-tool__orb-buttons')
			.appendTo($orbFooter);
		const $orbAddButton = $('<button>')
			.attr('id', 'cat-stats-tool__add-orb')
			.text('Set Orb')
			.appendTo($orbButtonWrapper)
			.on('click', function () {
				const catId = $(".cat-stats-tool__orb.active").attr('data-cat');
				const id = $(".cat-stats-tool__orb.active").attr('data-id');
				const effect = $("input[type='radio'][name='orb-effect']:checked").val();
				const grade = $("input[type='radio'][name='orb-grade']:checked").val();
				for (const cat of catList) {
					if (cat.id == catId) {
						cat.orbs[id] = { 'effect': effect, 'grade': grade };
						break;
					}
				}
			});
		const $orbRemoveButton = $('<button>')
			.attr('id', 'cat-stats-tool__remove-orb')
			.text('Remove')
			.appendTo($orbButtonWrapper)
			.on('click', function () {
				const catId = $(".cat-stats-tool__orb.active").attr('data-cat');
				const id = $(".cat-stats-tool__orb.active").attr('data-id');
				for (const cat of catList) {
					if (cat.id == catId) {
						cat.orbs[id] = false;
						break;
					}
				}
			});
		const $orbMenuClose = $('<button>')
			.attr('id', 'cat-stats-tool__close-orb-menu')
			.text('Close')
			.appendTo($orbFooter)
			.on('click', function () {
				orbMenu = false;
				$orbFooter.hide();
				$tableFooter.show();
				$('.cat-stats-tool__orb.active').removeClass('active');
			});
		let orbMenu = false;

		// pagination
		const $paginationFooter = $('<tfoot>')
			.attr('id', 'cat-stats-tool__pagination')
			.addClass('pagination-hidden')
			.appendTo($resultsTable);
		$(document).on('click', '.cat-stats-tool__pagination-page', function () {
			currentPage = Number($(this).text()) - 1;
			showCurrentPage();
			paginate();
		});
		const $pagePrev = $('<a>')
			.text('«')
			.on('click', function () {
				if (currentPage > 0) {
					currentPage--;
					showCurrentPage();
					paginate();
				}
			});
		const $pageNext = $('<a>')
			.text('»')
			.on('click', function () {
				if (currentPage < Math.ceil(catList.length / rowsPerPage) - 1) {
					currentPage++;
					showCurrentPage();
					paginate();
				}
			});
		const $pageInput = $('<input>')
			.attr({
				'id': 'cat-stats-tool__pagination-input',
				'type': 'text',
				'placeholder': 'Page'
			})
			.on({
				'input': function () {
					$(this).val($(this).val().replace(/[^0-9]/g, ""));
				},
				'blur': function () {
					const newPage = Number($(this).val()) - 1;
					if (newPage >= Math.ceil(catList.length / rowsPerPage) || newPage < 0) return;
					currentPage = newPage;
					showCurrentPage();
					paginate();
				},
				'keydown': function (e) {
					if (e.which == 13) {
						$(this).trigger('blur');
					}
				}
			});

		// column display checkboxes
		const $columnSettings = $('#cat-stats-tool__column-settings');
		const colSettingsStr = localStorage.getItem('catStatsToolColumns'); // formatted as a list of column class names with | as the delimiter
		let colSettings;
		if (colSettingsStr !== null) {
			colSettings = new Set(colSettingsStr.split('|'));
		} else {
			colSettings = new Set(Object.values(toggleableColumns));
			colSettings = colSettings.difference(hiddenColumns);
			if (screen.width <= mobileThreshold) {
				colSettings = colSettings.difference(hiddenMobileColumns);
			}
		}
		for (const col in toggleableColumns) {
			const colClass = toggleableColumns[col];
			const $inputSpan = $('<span>')
				.attr('title', `Toggle whether the ${col} column is shown`)
				.appendTo($columnSettings);
			$('<input>')
				.attr({
					'id': `cat-stats-tool__checkbox-${colClass}`,
					'type': 'checkbox',
					'value': colClass
				})
				.prop('checked', colSettings.has(colClass))
				.appendTo($inputSpan);
			$('<label>')
				.attr('for', `cat-stats-tool__checkbox-${colClass}`)
				.html(col)
				.appendTo($inputSpan);
			if (!colSettings.has(colClass)) {
				$(`.cat-stats-tool__cell-${colClass}`).addClass('col-hidden');
			}
		}
		$('#cat-stats-tool__column-settings input').on('change', function () {
			const changed = $(this).val();
			$(`th.cat-stats-tool__cell-${changed}`).toggleClass('col-hidden');
			for (const cat of catList) {
				cat.cellDisplay[changed] = !cat.cellDisplay[changed];
			}
			if ($(this).is(':checked')) {
				colSettings.add(changed);
			} else {
				colSettings.delete(changed);
			}
			localStorage.setItem('catStatsToolColumns', [...colSettings].join('|'));
		});

		// simple version toggle
		const $container = $('#cat-stats-tool');
		const $simple = $('<span>', {
			'title': 'Use a lightweight appearance',
			'style': 'margin-left: auto;'
		}).appendTo($columnSettings);
		const $simpleInput = $('<input>', {
			'id': 'cat-stats-tool__checkbox-simple',
			'type': 'checkbox'
		})
			.appendTo($simple)
			.on('click', function () {
				mw.storage.set('catstatssimple', mw.storage.get('catstatssimple') !== 'true');
				$container.toggleClass('appearance-simple');
			});
		$('<label>', {
			'for': 'cat-stats-tool__checkbox-simple'
		})
			.text('Simple')
			.appendTo($simple);
		if (mw.storage.get('catstatssimple') === 'true') {
			$container.addClass('appearance-simple');
			$simpleInput.prop('checked', true);
		}

		// beta button
		const $beta = $('<span>', {
			'title': 'Enable the beta version of this tool'
		}).appendTo($columnSettings);
		const $betaInput = $('<input>', {
			'id': 'cat-stats-tool__checkbox-beta',
			'type': 'checkbox',
			'value': 'beta'
		})
			.appendTo($beta)
			.on('click', function () {
				mw.storage.set('catstatsbeta', mw.storage.get('catstatsbeta') !== 'true');
				location.reload();
			});
		$('<label>', {
			'for': 'cat-stats-tool__checkbox-beta'
		})
			.text('Beta')
			.appendTo($beta);
		if (mw.storage.get('catstatsbeta') === 'true') $betaInput.prop('checked', true);

		// combo selector
		let combos = {
			'Attack': [],
			'Defense': [],
			'Speed': [],
			'Research': [],
			'Strong': [],
			'Massive Damage': [],
			'Resistant': [],
			'Slow': [],
			'Freeze': [],
			'Weaken': [],
			'Strengthen': [],
			'Critical': []
		};
		const $comboSelector = $('#cat-stats-tool__combo-selector');
		const $comboOptions = $('#cat-stats-tool__combo-options');
		const $comboList = $('#cat-stats-tool__combo-list');
		const $comboEffectSelect = $('<select>')
			.attr('id', 'cat-stats-tool__combo-effect-select')
			.appendTo($comboOptions);
		for (const comboEffect in comboEffects) {
			$('<option>')
				.attr('value', comboEffect)
				.text(comboEffects[comboEffect])
				.appendTo($comboEffectSelect);
		}
		const $comboSizeSelect = $('<select>')
			.attr('id', 'cat-stats-tool__combo-size-select')
			.appendTo($comboOptions);
		for (const comboSize of comboSizes) {
			$('<option>')
				.attr('value', comboSize)
				.text(comboSize)
				.appendTo($comboSizeSelect);
		}
		const $comboAddButton = $('<button>')
			.addClass('cat-stats-tool__button')
			.attr('id', 'cat-stats-tool__combo-add')
			.text('Add')
			.appendTo($comboOptions)
			.on('click', function () {
				const eff = $comboEffectSelect.val();
				const size = $comboSizeSelect.val();
				const mag = comboSizes.indexOf(size);
				const fullEffect = `${eff} (${size})`;
				$('<div>')
					.addClass(`cat-stats-tool__mini-combo${existingComboEffects.has(fullEffect) ? '' : ' nonexistent-combo'}`)
					.attr({
						'data-effect': comboEffects[eff],
						'data-size': mag
					})
					.text(fullEffect)
					.appendTo($comboList);
				combos[comboEffects[eff]].push(mag);
				updateCats();
			});
		const $comboClearButton = $('<button>')
			.addClass('cat-stats-tool__button')
			.attr('id', 'cat-stats-tool__combo-clear')
			.text('Clear')
			.appendTo($comboOptions)
			.on('click', function () {
				$comboList.empty();
				for (const eff in combos) {
					combos[eff] = [];
				}
				updateCats();
			});
		$(document).on('click', '.cat-stats-tool__mini-combo', function () {
			const eff = $(this).attr('data-effect');
			const mag = Number($(this).attr('data-size'));
			$(this).remove();
			combos[eff].splice(combos[eff].indexOf(mag), 1);
			updateCats();
		});

		// foundation level slider
		let foundationLevel = 0;
		const $foundationLevel = $('#cat-stats-tool__foundation-level');
		const $foundationSlider = $('<input>')
			.attr({
				'id': 'cat-stats-tool__foundation-slider',
				'type': 'range',
				'min': 0,
				'max': 20,
				'value': 0
			})
			.prependTo($('#cat-stats-tool__foundation'))
			.on('input', function () {
				const val = $foundationSlider.val();
				$foundationLevel.empty();
				for (let i = 0; i < val.length; i++) {
					$foundationLevel.append(`<span class="level-image" data-value="${val.charAt(i)}"></span>`);
				}
				foundationLevel = Number(val);
				updateCats();
			});

		// chart setup
		function cssVar(name) {
			return window.getComputedStyle(document.body).getPropertyValue(name);
		}

		const $graphCanvas = $('<canvas id="cat-stats-tool__graph" class="graph-empty"></canvas>')
			.appendTo($container);
		let graphData = [];
		let graphNames = [];
		const $graphClear = $('<button id="cat-stats-tool__graph-clear" class="cat-stats-tool__button" disabled>Clear DPS Graph</button>')
			.appendTo($('#cat-stats-tool__bottom-options'))
			.on('click', function () {
				graphData = [];
				graphNames = [];
				$graphCanvas.addClass('graph-empty');
				$(this).prop('disabled', true);
			});
		const $graphOptions = $('<div id="cat-stats-tool__graph-options"> ~ </div>')
			.appendTo($container);
		const $graphRangeLower = $('<input class="cat-stats-tool__graph-input" type="number">')
			.prependTo($graphOptions)
			.on('change', updateChart);
		const $graphRangeUpper = $('<input class="cat-stats-tool__graph-input" type="number">')
			.appendTo($graphOptions)
			.on('change', updateChart);

		var chart;
		function initChart() {
			Chart.defaults.color = cssVar('--theme-page-text-color');

			chart = new Chart($graphCanvas[0], {
				type: 'line',
				data: {
					datasets: [{
						label: 'placeholder',
						data: [[0, 0], [1, 1]]
					}]
				},
				options: {
					scales: {
						x: {
							type: 'linear',
							ticks: {
								callback: value => Number(value).toFixed(0),
								stepSize: 100,
								autoSkip: false
							},
							grid: {
								color: cssVar('--bg-color-gray')
							},
							min: -320,
							max: 80
						},
						y: {
							grid: {
								color: cssVar('--bg-color-gray')
							},
							type: 'linear',
							min: 0
						}
					},
					elements: {
						point: {
							radius: 0
						}
					},
					layout: {
						padding: screen.width > mobileThreshold ? 5 : 0
					},
					plugins: {
						customCanvasBackgroundColor: {
							color: cssVar('--theme-page-background-color')
						}
					},
					animation: false
				},
				plugins: [{
					id: 'customCanvasBackgroundColor',
					beforeDraw: (chart, args, options) => {
						const { ctx } = chart;
						ctx.save();
						ctx.globalCompositeOperation = 'destination-over';
						ctx.fillStyle = options.color;
						ctx.fillRect(0, 0, chart.width, chart.height);
						ctx.restore();
					}
				}]
			});
		}

		function updateChart() {
			if (!chart) {
				initChart();
			}
			let minRange = Math.ceil(Math.min(...graphData.map(d => d[0][0])) / 100) * 100 - 100;
			let maxRange = Math.floor(Math.max(...graphData.map(d => d[d.length - 1][0])) / 100) * 100 + 100;
			const minVal = $graphRangeLower.val();
			const maxVal = $graphRangeUpper.val();
			if (minVal != '') minRange = Number(minVal);
			if (maxVal != '') maxRange = Number(maxVal);
			const dataArray = [];
			let i = 0;
			for (let d of graphData) {
				dataArray.push({
					label: graphNames[i],
					data: [[minRange, 0], [d[0][0] - 1, 0]].concat(d).concat([[d[d.length - 1][0] + 1, 0], [maxRange, 0]])
				});
				i++;
			}
			// update graph
			chart.data.datasets = dataArray;
			chart.options.scales.x.min = minRange;
			chart.options.scales.x.max = maxRange;
			chart.update();
		}

		// read data
		const existingComboEffects = new Set([]);
		for (const row of data_Lineup_Combos) {
			existingComboEffects.add(row.effect);
		}
		const filterData = [];
		for (const item of data_CatData) {
			const filterItem = {
				'id': item.id,
				'form': item.form.toString(),
				'rarity': item.rarity.toString(),
				'target': new Set(item.targets),
				'ability': new Set([item.type.toLowerCase()].concat(Object.keys(item.abilities))),
				'normal': new Set([item.type.toLowerCase()].concat(Object.keys(item.abilities), item.targets)),
				'talents': new Set(data_FilterIconInfo_CatData[(item.id + 1).toString()].talents),
				'ultra': new Set(data_FilterIconInfo_CatData[(item.id + 1).toString()].ultratalents)
			};
			for (const stat in filterableStats) {
				filterItem[stat] = item[stat];
			}
			filterData.push(filterItem);
		}

		// adding or removing cats
		let catList = [];
		$addCat.on('input', function (event) {
			const input = $(event.target).val().trim().toLowerCase().replaceAll(/[‘’]/g, "'").replaceAll(/[“”]/g, '"');
			let filtered;
			const cro = parseInt(input.slice(0, 3));
			if (input.length >= 3 && !isNaN(cro)) {
				// using cro
				if (input.charAt(3) == '-' && input.length >= 5) {
					filtered = data_CatData.filter((item) => item.id == cro && item.form == parseInt(input.slice(4)));
				} else {
					filtered = data_CatData.filter((item) => item.id == cro);
				}
			} else {
				// filter names that contain the input as a substring
				filtered = data_CatData.filter((item) => item.name.toLowerCase().includes(input));
				searchLength = filtered.length > 5 ? 5 : filtered.length;
				filtered = filtered.sort(function (a, b) {
					// names that start with the input
					let boolA, boolB;
					a = a.name.toLowerCase();
					b = b.name.toLowerCase();
					boolA = a.startsWith(input);
					boolB = b.startsWith(input);
					if (boolA || boolB) return boolA && boolB ? 0 : (boolA ? -1 : 1);
					// names that contain a word that starts with the input
					const tokensA = a.split(' ');
					for (const word of tokensA) {
						if (word.startsWith(input)) {
							boolA = true;
							break;
						}
					}
					const tokensB = b.split(' ');
					for (const word of tokensB) {
						if (word.startsWith(input)) {
							boolB = true;
							break;
						}
					}
					if (boolA || boolB) return boolA && boolB ? 0 : (boolA ? -1 : 1);
					return 0;
				}).slice(0, maxSearchResults);
			}
			$searchList.empty();
			for (const info of filtered) {
				const $searchItem = $('<li>')
					.addClass('cat-stats-tool__search-item')
					.attr('data-content-index', data_CatData.indexOf(info))
					.text(info.name)
					.appendTo($searchList);
			}
		});
		$(document).on('click', '.cat-stats-tool__search-item', function () {
			const cat = new Cat(Number($(this).attr('data-content-index')));
			catList.push(cat);
			if (catList.length < (currentPage + 1) * rowsPerPage && catList.length > currentPage * rowsPerPage) {
				cat.add();
				$tableBody.append($spaceRow.clone());
			}
			paginate();
		});
		$addAll.on({
			'click': function () {
				for (let i = 0; i < data_CatData.length; i++) {
					if (!matchesFilter(i)) continue;
					let talentState = 0;
					if (filters.talents || filters.ultra) {
						const noTalents = structuredClone(filterData[i]);
						noTalents.ability = noTalents.ability.difference(noTalents.talents).difference(noTalents.ultra);
						noTalents.target = noTalents.target.difference(noTalents.talents).difference(noTalents.ultra);
						if (!matchesFilter(i, noTalents)) {
							const noUltra = structuredClone(filterData[i]);
							noUltra.ability = noUltra.ability.difference(noUltra.ultra);
							noUltra.target = noUltra.target.difference(noUltra.ultra);
							talentState = matchesFilter(i, noUltra) ? 1 : 2;
						}
					}
					const newCat = new Cat(i, { 'talent': talentState });
					catList.push(newCat);
					if (catList.length < rowsPerPage) {
						newCat.add();
						$tableBody.append($spaceRow.clone());
					}
				}
				paginate();
			},
			'contextmenu': function (e) {
				e.preventDefault();
				currentPage = 0;
				resetTable();
				catList = [];
				$(this).trigger('click');
			}
		});
		$clearCats.on({
			'click': function () {
				if (noSelection) {
					currentPage = 0;
					resetTable();
					$paginationFooter.addClass('pagination-hidden');
					catList = [];
				} else {
					let allSelected = true;
					let noneSelected = true;
					for (const cat of catList) {
						if (matchesFilter(cat.index)) {
							cat.delete();
						} else {
							if (cat.selected) noneSelected = false;
							if (!cat.selected) allSelected = false;
						}
					}
					noSelection = noneSelected || allSelected;
				}
			},
			'contextmenu': function (e) {
				e.preventDefault();
				currentPage = 0;
				resetTable();
				$paginationFooter.addClass('pagination-hidden');
				catList = [];
			}
		});
		const $detailArea = $('#cat-stats-tool__details');

		// other events
		if (mobileControls) {
			$(document).on('click', function (e) {
				if ($(e.target).hasClass('cat-stats-tool__ability-icon')) return;
				if (orbMenu) {
					$tableFooter.hide();
					$orbFooter.show();
				}
				showDetails();
				$('.ability-viewing').removeClass('ability-viewing');
			});
		}
		$(document).on('click', '.cat-stats-tool__cell[data-sort]', function () {
			navigator.clipboard.writeText(this.dataset.sort);
			$(this).addClass('copy-active');
			setTimeout(() => {
				$(this).removeClass('copy-active');
			}, copyPopupLength);
		});

		// remove loading and display tool
		$('#cat-stats-tool__loading').remove();
		$container.show();

		// makes pagination menu
		function paginate() {
			const pageCount = Math.ceil(catList.length / rowsPerPage);
			if (pageCount > 1) {
				$paginationFooter.removeClass('pagination-hidden');
			} else {
				$paginationFooter.addClass('pagination-hidden');
				return;
			}
			$paginationFooter.html($pagePrev.clone(true, true));
			if (pageCount <= 7) {
				for (let i = 0; i < pageCount; i++) {
					$('<a>')
						.addClass('cat-stats-tool__pagination-page')
						.text(i + 1)
						.attr('data-page', i)
						.appendTo($paginationFooter);
				}
			} else {
				if (currentPage <= 3) {
					for (let i = 0; i <= currentPage + 1; i++) {
						$('<a>')
							.addClass('cat-stats-tool__pagination-page')
							.text(i + 1)
							.attr('data-page', i)
							.appendTo($paginationFooter);
					}
					$('<span>⋯</span>').appendTo($paginationFooter);
					$(`<a class="cat-stats-tool__pagination-page" data-page="${pageCount - 1}">${pageCount}</a>`).appendTo($paginationFooter);
				} else if (currentPage >= pageCount - 3) {
					$('<a class="cat-stats-tool__pagination-page" data-page="0">1</a>').appendTo($paginationFooter);
					$('<span>⋯</span>').appendTo($paginationFooter);
					for (let i = currentPage - 1; i < pageCount; i++) {
						$('<a>')
							.addClass('cat-stats-tool__pagination-page')
							.text(i + 1)
							.attr('data-page', i)
							.appendTo($paginationFooter);
					}
				} else {
					$('<a class="cat-stats-tool__pagination-page" data-page="0">1</a>').appendTo($paginationFooter);
					$('<span>⋯</span>').appendTo($paginationFooter);
					for (let i = currentPage - 1; i <= currentPage + 1; i++) {
						$('<a>')
							.addClass('cat-stats-tool__pagination-page')
							.text(i + 1)
							.attr('data-page', i)
							.appendTo($paginationFooter);
					}
					$('<span>⋯</span>').appendTo($paginationFooter);
					$(`<a class="cat-stats-tool__pagination-page" data-page="${pageCount - 1}">${pageCount}</a>`).appendTo($paginationFooter);
				}
			}
			$paginationFooter.append($pageNext.clone(true, true), $pageInput.clone(true, true));
			$('.cat-stats-tool__pagination-page').removeClass('current-page');
			$(`.cat-stats-tool__pagination-page[data-page="${currentPage}"]`).addClass('current-page');
		}

		// shows the current page
		function showCurrentPage() {
			resetTable();
			for (const cat of catList.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage)) {
				cat.add();
				$tableBody.append($spaceRow.clone());
			}
		}

		// resets the table
		function resetTable() {
			for (const cat of catList) {
				cat.remove();
			}
			cleanSpaces();
		}

		// inserts text into the bottom area
		function showDetails(text = '') {
			$detailArea.html(text);
		}

		// update stats of all cats
		function updateCats() {
			for (const cat of catList) {
				cat.calculate();
				cat.updateAbilities();
			}
		}

		// calculates the probability of a surge hitting an enemy at standing range
		function calcSurgeProb(standing, spawnRange) {
			const hitRange = [standing - 125, standing + 250];
			if (spawnRange[0] > hitRange[1] || spawnRange[1] < hitRange[0]) return 0;
			const union = [Math.max(hitRange[0], spawnRange[0]), Math.min(hitRange[1], spawnRange[1])];
			return (union[1] - union[0]) / (spawnRange[1] - spawnRange[0]);
		}

		// calculates how much explosion damage an enemy at standing range receives
		function calcExplosionMultiplier(standing, explosion) {
			if (Math.abs(standing - explosion) <= 75) return 1;
			if (Math.abs(standing - explosion) > 75 && Math.abs(standing - explosion) <= 175) return 0.7;
			if (Math.abs(standing - explosion) > 175 && Math.abs(standing - explosion) <= 275) return 0.4;
			return 0;
		}

		// turns a string like '50+80' into a number 130
		function numericLevel(level) {
			if (!level.includes('+')) return Number(level);
			const parts = level.split('+');
			return Number(parts[0]) + Number(parts[1]);
		}

		// returns if a given range in front of a unit is outside the provided interval
		function notInRange(range, interval) {
			if (!interval) return false;
			return range < interval[0] || range > interval[1];
		}

		// gets the total modifier of combos of a certain effect
		function getComboTotal(effect) {
			let result = 0;
			for (const mag of combos[effect]) {
				result += comboNums[effect][mag];
			}
			return result;
		}

		// retrieves the value of the default level input
		function getDefaultLevel(inputElement = $defaultLevel) {
			const result = inputElement.val();
			return result === '' ? initialDefaultLevel : result;
		}

		// returns the html inserted into the ability description area
		function abilityDisplay(name, text) {
			const str = `<div class="cat-stats-tool__ability-text"><span class="cat-stats-tool__ability-name">【${name}】</span>${text}</div>`;
			return str;
		}

		// clears extra space tr elements from the table body
		function cleanSpaces() {
			$('#cat-stats-tool__table-body .cat-stats-tool__table-space + .cat-stats-tool__table-space').remove();
		}

		// turns a number of frames into equivalent seconds rounded to two decimal points
		function framesToSeconds(f) {
			return Math.round(f / 30 * 100) / 100;
		}

		// gets the sum of numbers in an array
		function sum(a) {
			let sum = 0;
			for (const n of a) {
				sum += n;
			}
			return sum;
		}

		// returns a number formatted the way it would be displayed on screen (rounded, comma formatted)
		function toDisplayString(number) {
			return number.toLocaleString(undefined, { maximumFractionDigits: decimalPoints });
		}

		// capitalizes the first letter of the string
		function capitalize(str) {
			return str.charAt(0).toUpperCase() + str.slice(1);
		}

		// returns whether the cat with the given filter data matches filter parameters
		function matchesFilter(index, data = undefined) {
			const unitFilterData = data ? data : filterData[index];
			if (filters.maxForm && filterData[(index + 1) % filterData.length].id == unitFilterData.id) return false;
			if (filters.rarity[1].size > 0 && !filters.rarity[1].has(unitFilterData.rarity)) return false;
			if (filters.form[1].size > 0 && !filters.form[1].has(unitFilterData.form)) return false;
			if (filters.talent == 1 && unitFilterData.id in data_TalentData) return false;
			if (filters.talent == 2 && !(unitFilterData.id in data_TalentData)) return false;
			if (filters.talent == 3 && !(unitFilterData.id in data_UltraTalentData)) return false;
			if (filters.target[1].size > 0 && filters.target[1].isDisjointFrom(unitFilterData.target)) return false;
			if (filters.target[2].size > 0 && !filters.target[2].isSubsetOf(unitFilterData.target)) return false;
			if (filters.target[3].size > 0 && !filters.target[3].isDisjointFrom(unitFilterData.target)) return false;
			if (filters.ability[1].size > 0 && filters.ability[1].isDisjointFrom(unitFilterData.ability)) return false;
			if (filters.ability[2].size > 0 && !filters.ability[2].isSubsetOf(unitFilterData.ability)) return false;
			if (filters.ability[3].size > 0 && !filters.ability[3].isDisjointFrom(unitFilterData.ability)) return false;
			let done = false;
			for (const stat in filterableStats) {
				if ((unitFilterData[stat] < filters[stat][0]) || (unitFilterData[stat] > filters[stat][1])) {
					done = true;
					break;
				}
			}
			return !done;
		}

		// reused elements
		const $DELETE = new OO.ui.ButtonWidget({
			framed: false,
			flags: [
				'destructive'
			],
			classes: ["single-cat-delete"],
			invisibleLabel: true,
			icon: 'close',
			label: 'Remove Cat'
		}).$element;
		const $COPY = new OO.ui.ButtonWidget({
			framed: false,
			flags: [
				'progressive'
			],
			classes: ["single-cat-copy"],
			invisibleLabel: true,
			icon: 'copy',
			label: 'Duplicate Cat'
		}).$element;
		const $DRAG = $('<div>')
			.addClass('cat-drag');
		const $PLOT = new OO.ui.ButtonWidget({
			framed: false,
			classes: ["single-cat-plot"],
			invisibleLabel: true,
			icon: 'plot',
			label: 'Plot DPS Graph'
		}).$element;
		const statsPlaceholder = $('<td>')
			.addClass(`cat-stats-tool__cell`);
		const $arrowImage = $('<img>')
			.addClass('cat-stats-tool__arrow')
			.attr({
				'src': 'https://static.wikitide.net/battlecatswiki/8/86/AbilityInfoArrow.png',
				'loading': 'lazy',
				'decoding': 'async',
				'width': '37',
				'height': '44',
			});

		class Cat {
			// create all the necessary data
			constructor(index, params = {}) {
				const data = data_CatData[index];
				this.data = JSON.parse(JSON.stringify(data_CatData[index]));
				this.initialData = data_CatData[index];
				this.index = index;
				this.id = catCounter;
				this.order = catCounter;
				catCounter++;
				this.selected = false;
				this.defaultLevel = params.hasOwnProperty('level') ? params.level : getDefaultLevel();
				this.loaded = false;
				this.talents = {};
				this.ultra = {};
				this.talentMode = params.hasOwnProperty('talent') ? params.talent : 0;
				this.orbCount = 0;
				if (data.id in data_TalentData && data.form >= 2) {
					this.talents = data_TalentData[this.data.id][this.data.form - 2];
					this.orbCount++;
					if (this.data.id in data_UltraTalentData) {
						this.ultra = data_UltraTalentData[this.data.id][0];
						this.orbCount++;
					}
				}
				if (this.talentMode >= 1) {
					for (const talent in this.talents) {
						this.data.abilities[talent] = this.talents[talent];
					}
					if (this.talentMode >= 2) {
						for (const ultra in this.ultra) {
							this.data.abilities[ultra] = this.ultra[ultra];
						}
					}
				}
				this.orbs = params.hasOwnProperty('orbs') ? params.orbs : [false, false];
				this.orbData = params.hasOwnProperty('orbData') ? params.orbData : {
					'attack': 0,
					'defense': 0,
					'strong': 0,
					'massive': 0,
					'resist': 0,
					'colossus': 0,
					'sol': 0
				};
				this.selectedTrait = params.hasOwnProperty('trait') ? params.trait : '';
				this.traitToggles = [];
				for (const trait of traitList) {
					if (trait == 'metal') {
						this.traitToggles.push(false);
					} else {
						this.traitToggles.push(this.data.targets.includes(trait) ? false : 0);
					}
				}
				if (this.selectedTrait != '') this.traitToggles[traitList.indexOf(this.selectedTrait)] = true;
				this.traitToggles = new Proxy(this.traitToggles, {
					set: (target, key, value, receiver) => {
						if (target[key] === 0 || value === 0) {
							target[key] = value;
						} else {
							if (value) {
								this.selectedTrait = traitList[key];
								this.fruit = nonFruitTraits.includes(this.selectedTrait) ? 0 : 1;
							} else {
								this.selectedTrait = '';
								this.fruit = -1;
							}
							for (let i = 0; i < target.length; i++) {
								if (target[i] !== 0) {
									target[i] = false;
								}
							}
							target[key] = value;
							this.calculate();
						}
						return true;
					}
				});
				this.fruit = -1; // -1 for no selected traits, 0 for trait without fruit treasures, 1 for trait with fruit
				if (this.selectedTrait != '') {
					this.fruit = fruitTraits.includes(this.selectedTrait) ? 1 : 0;
				}
				this.fruitChangeType = -1; // -1 for no targets, 0 for only fruit traits, 1 for only non-fruit traits, 2 for combination
				if (this.data.targets.length > 0) {
					const hasFruitTarget = this.data.targets.some(item => fruitTraits.includes(item));
					const hasNonfruitTarget = this.data.targets.some(item => nonFruitTraits.includes(item));
					if (hasFruitTarget && !hasNonfruitTarget) {
						this.fruitChangeType = 0;
					} else if (hasNonfruitTarget && !hasFruitTarget) {
						this.fruitChangeType = 1;
					} else {
						this.fruitChangeType = 2;
					}
				}
				this.abilityToggles = params.hasOwnProperty('abilities') ? params.abilities : {};
				if ($.isEmptyObject(this.abilityToggles)) {
					for (const ability in toggleableAbilities) {
						this.abilityToggles[ability] = toggleableAbilities[ability];
					}
				}
				let [hp, hpExp, hpMax] = this.calcHealth();
				let [atk, atkExp, atkMax] = this.calcDamage();
				let [dps, dpsExp, dpsMax] = [this.calcDPS(atk), this.calcDPS(atkExp), this.calcDPS(atkMax)];
				let spd = Math.floor(this.data.spd * (1 + getComboTotal('Speed')));
				let rech = this.data.rech - getComboTotal('Research');
				if (rech < 60) rech = 60;
				this.cellSortValues = {};
				const colInfo = [
					['name', data.name],
					['hp', hp],
					['hpExp', hpExp],
					['hpMax', hpMax],
					['atk', atk],
					['atkExp', atkExp],
					['atkMax', atkMax],
					['dps', dps],
					['dpsExp', dpsExp],
					['dpsMax', dpsMax],
					['frequency', data.freq],
					['foreswing', data.fore],
					['backswing', data.back],
					['tba', data.tba],
					['range', data.rng],
					['speed', spd],
					['knockbacks', data.kb],
					['recharge', rech],
					['cost', data.cost],
					['type', data.type]
				];
				for (const col of colInfo) {
					this.cellSortValues[col[0]] = col[1];
				}
				this.cellDisplay = {};
				for (const cellClass of Object.values(toggleableColumns)) {
					this.cellDisplay[cellClass] = colSettings.has(cellClass);
				}
				if (this.talentMode >= 1) {
					this.talentMode = (this.talentMode - 1) % ($.isEmptyObject(this.ultra) ? 2 : 3);
					this.talentHandler();
				}
			}

			createHTML(replace = false) {
				this.loaded = true;
				this.$row = $('<tr>', {
					'class': 'cat-stats-tool__entry',
					'id': this.id
				});
				this.$row.attr('draggable', true);
				this.$row[0].ondragstart = (e) => {
					if (!$(document.elementFromPoint(e.clientX, e.clientY)).hasClass('cat-drag')) e.preventDefault();
					$dragRow = this.$row;
				};
				this.$row[0].ondragover = (e) => {
					e.preventDefault();
				};
				this.$row[0].ondrop = (e) => {
					e.preventDefault();
					const $dropRow = $(e.target).closest('tr.cat-stats-tool__entry');
					const $rowList = $dropRow.parent().children();
					let dragRow, dropRow;
					if ($rowList.index($dropRow) > $rowList.index($dragRow)) {
						$dropRow.after($dragRow);
						for (const cat of catList) {
							if (cat.id == $dragRow.attr('id')) {
								dragRow = cat;
								continue;
							}
							if (cat.id == $dropRow.attr('id')) {
								dropRow = cat;
								break;
							}
						}
						catList.splice(catList.indexOf(dragRow), 1);
						catList.splice(catList.indexOf(dropRow) + 1, 0, dragRow);
					} else {
						$dropRow.before($dragRow);
						for (const cat of catList) {
							if (cat.id == $dropRow.attr('id')) {
								dropRow = cat;
								continue;
							}
							if (cat.id == $dragRow.attr('id')) {
								dragRow = cat;
								break;
							}
						}
						catList.splice(catList.indexOf(dragRow), 1);
						catList.splice(catList.indexOf(dropRow), 0, dragRow);
					}
					$('.cat-stats-tool__entry + .cat-stats-tool__entry').before($spaceRow.clone());
					cleanSpaces();
				};
				if (this.selected) this.$row.addClass('cat-selected');
				const $iconContainer = $('<div>');
				const $iconWrapper = $('<div>')
					.css({ position: "relative" })
					// <nowiki>
					.html(`<a href="${this.data.link}"><img src="https://static.wikitide.net/battlecatswiki/${this.data.img}" title="${this.data.name}" loading="lazy"></a>`)
					// </nowiki>
					.appendTo($iconContainer);
				const $buttonWrapper = $('<div>')
					.addClass('cat-stats-tool__button-wrapper')
					.appendTo($iconContainer);
				const $deleteButton = $DELETE.clone().on('click', () => { this.delete(); });
				$deleteButton.appendTo($buttonWrapper);
				const $dragArea = $DRAG.clone();
				$dragArea.appendTo($buttonWrapper);
				const $copyButton = $COPY.clone().on('click', () => { this.duplicate(); });
				$copyButton.appendTo($buttonWrapper);
				const $plotButton = $PLOT.clone().on('click', () => { this.plotDPSGraph(); });
				$plotButton.appendTo($buttonWrapper);
				const $numberDiv = $('<div>')
					.addClass('cat-stats-tool__input-number-images')
					.appendTo($iconWrapper);
				this.$levelInput = $(`<input type="text" class="cat-stats-tool__input" value="${this.defaultLevel}">`)
					.appendTo($iconWrapper)
					.on({
						'focus': () => {
							this.$levelInput.removeClass('invisible');
							$numberDiv.addClass('invisible');
						},
						'blur': () => {
							this.$levelInput.addClass('invisible');
							$numberDiv.removeClass('invisible');
						},
						'input': function () {
							$(this).val($(this).val().replace(/[^0-9+]/g, ""));
						},
						'change': () => {
							this.calculate();
							this.updateAbilities();
							$numberDiv.empty();
							const str = this.$levelInput.val();
							for (let i = 0; i < str.length; i++) {
								$numberDiv.append(`<span class="level-image" data-value="${str.charAt(i)}"></span>`);
							}
						}
					});
				this.$levelInput.addClass('invisible');
				const str = this.$levelInput.val();
				for (let i = 0; i < str.length; i++) {
					$numberDiv.append(`<span class="level-image" data-value="${str.charAt(i)}"></span>`);
				}
				const $formToggle = $('<button>')
					.addClass('cat-stats-tool__form-toggle')
					.attr('title', 'Toggle forms')
					.appendTo($iconContainer)
					.on('click', () => { this.switchForm(); });
				if (this.data.id in data_TalentData && this.data.form >= 2) {
					this.$talentToggle = $('<button>')
						.addClass('cat-stats-tool__talent-toggle')
						.attr('title', 'Toggle Talents')
						.appendTo($iconContainer)
						.on({
							'click': () => { this.talentHandler(); },
							'contextmenu': (e) => {
								e.preventDefault();
								for (const cat of catList) {
									if (!(cat.selected || noSelection) || $.isEmptyObject(cat.talents)) continue;
									cat.talentHandler();
								}
							}
						});
					switch (this.talentMode) {
						case 0:
							this.$talentToggle.addClass('talents-off');
							break;
						case 1:
							this.$talentToggle.addClass('talents-on');
							break;
						case 2:
							this.$talentToggle.addClass('talents-ultra');
					}
				}
				this.orbButtons = [];
				if (this.orbCount >= 1) {
					const orb = $('<div>')
						.addClass('cat-stats-tool__orb empty')
						.attr({
							'data-cat': this.id,
							'data-id': 0,
							'data-effect': 'attack',
							'data-grade': 's'
						})
						.html('<div class="spritesheet orb-spritesheet"></div><div class="spritesheet effect-spritesheet"></div><div class="spritesheet grade-spritesheet"></div>')
						.on('click', (e) => { this.orbHandler(e); });
					this.orbButtons.push(orb);
					if (this.orbs[0]) {
						orb
							.removeClass('empty')
							.attr({
								'data-effect': this.orbs[0].effect,
								'data-grade': this.orbs[0].grade
							});
					}
				}
				if (this.orbCount >= 2) {
					this.orbButtons.push(this.orbButtons[0].clone(true, true));
					this.orbButtons[1].attr('data-id', 1);
					if (this.orbs[1]) {
						this.orbButtons[1]
							.removeClass('empty')
							.attr({
								'data-effect': this.orbs[1].effect,
								'data-grade': this.orbs[1].grade
							});
					} else {
						this.orbButtons[1].addClass('empty');
					}
				}
				this.traitIcons = this.createTraits();
				this.abilities = {};
				let effectElements = [];
				let abilityExclusives = [];
				if (!$.isEmptyObject(this.data.abilities)) {
					[effectElements, abilityExclusives] = this.createAbilities();
				}
				let [hp, hpExp, hpMax] = this.calcHealth();
				let [atk, atkExp, atkMax] = this.calcDamage();
				let [dps, dpsExp, dpsMax] = [this.calcDPS(atk), this.calcDPS(atkExp), this.calcDPS(atkMax)];
				let spd = Math.floor(this.data.spd * (1 + getComboTotal('Speed')));
				let rech = this.data.rech - getComboTotal('Research');
				if (rech < 60) rech = 60;
				this.cells = {};
				const colInfo = [
					['icon', $iconContainer],
					['space', ''],
					['name', `<a href="${this.data.link}">${this.data.name}</a>`, this.data.name],
					['hp', hp],
					['hpExp', hpExp],
					['hpMax', hpMax],
					['atk', atk],
					['atkExp', atkExp],
					['atkMax', atkMax],
					['dps', dps],
					['dpsExp', dpsExp],
					['dpsMax', dpsMax],
					['frequency', `${toDisplayString(this.data.freq)}f<sup>${framesToSeconds(this.data.freq)}s</sup>`, this.data.freq],
					['foreswing', `${toDisplayString(this.data.fore)}f<sup>${framesToSeconds(this.data.fore)}s</sup>`, this.data.fore],
					['backswing', `${toDisplayString(this.data.back)}f<sup>${framesToSeconds(this.data.back)}s</sup>`, this.data.back],
					['tba', `${toDisplayString(this.data.tba)}f<sup>${framesToSeconds(this.data.tba)}s</sup>`, this.data.tba],
					['range', this.data.rng],
					['speed', spd],
					['knockbacks', this.data.kb],
					['recharge', `${toDisplayString(rech)}f<sup>${framesToSeconds(rech)}s</sup>`, rech],
					['cost', `${toDisplayString(this.data.cost)}¢`, this.data.cost],
					['type', this.data.type, this.data.type],
					['targets', this.traitIcons],
					['arrow', $arrowImage.clone()],
					['effects', effectElements],
					['abilities', abilityExclusives],
					['orb', this.orbButtons],
					['space', '']
				];
				for (const cell of colInfo) {
					this.addCell(...cell);
				}
				for (const cell in this.cellDisplay) {
					if (!this.cellDisplay[cell]) {
						this.cells[cell].addClass('col-hidden');
					}
				}

				if (replace) {
					replace.replaceWith(this.$row);
				}

				this.cellDisplay = new Proxy(this.cellDisplay, {
					set: (target, key, value) => {
						target[key] = value;
						this.cells[key].toggleClass('col-hidden');
					}
				});
				this.traitToggles = new Proxy(this.traitToggles, {
					set: (target, key, value, receiver) => {
						if (target[key] === 0 || value === 0) {
							target[key] = value;
						} else {
							if (value) {
								this.selectedTrait = traitList[key];
								this.fruit = nonFruitTraits.includes(this.selectedTrait) ? 0 : 1;
							} else {
								this.selectedTrait = '';
								this.fruit = -1;
							}
							for (let i = 0; i < target.length; i++) {
								if (target[i] !== 0) {
									target[i] = false;
									this.traitIcons[i].children('input').prop('checked', false);
								}
							}
							target[key] = value;
							this.traitIcons[key].children('input').prop('checked', value);
							this.calculate();
							this.updateAbilities();
						}
						return true;
					}
				});
				this.abilityToggles = new Proxy(this.abilityToggles, {
					set: (target, key, value, receiver) => {
						target[key] = value;
						this.abilities[key].$abilityContainer.toggleClass('ability-disabled');
						return true;
					}
				});
				this.orbs = new Proxy(this.orbs, {
					set: (target, key, value, receiver) => {
						if (value instanceof Object) {
							$('.cat-stats-tool__orb.active')
								.removeClass('empty')
								.attr('data-effect', value.effect)
								.attr('data-grade', value.grade);
							if (value.effect == 'sol') {
								$("input[type='radio'][name='orb-effect'][value='sol']").prop('disabled', true);
							}
						} else {
							$('.cat-stats-tool__orb.active').addClass('empty');
							if (target[key].effect == 'sol') {
								$("input[type='radio'][name='orb-effect'][value='sol']").prop('disabled', false);
							}
						}
						target[key] = value;
						this.updateOrbData();
					}
				});
			}

			// updates base stats based on talents
			updateStats() {
				[this.data.hp, this.data.ap, this.data.freq, this.data.tba, this.data.spd, this.data.rech, this.data.cost] = [this.initialData.hp, this.initialData.ap, this.initialData.freq, this.initialData.tba, this.initialData.spd, this.initialData.rech, this.initialData.cost];
				const isMulti = 'multi-hit' in this.data.abilities;
				if (isMulti) {
					for (let i = 0; i < 9; i += 4) {
						this.data.abilities['multi-hit'][i] = this.initialData.abilities['multi-hit'][i];
					}
				}
				// talents
				if (!$.isEmptyObject(this.talents) && this.talentMode >= 1) {
					if ('tba' in this.talents) {
						this.data.tba = this.talents.tba[0];
						this.data.freq = this.talents.tba[2];
					}
					if ('spd' in this.talents) this.data.spd += this.talents.spd[0];
					if ('rech' in this.talents) this.data.rech -= this.talents.rech[0];
					if ('cost' in this.talents) this.data.cost -= this.talents.cost[0];
				}
				// ultra talents
				if (!$.isEmptyObject(this.ultra) && this.talentMode >= 2) {
					if ('tba' in this.ultra) {
						this.data.tba = this.ultra.tba[0];
						this.data.freq = this.ultra.tba[2];
					}
					if ('spd' in this.ultra) this.data.spd += this.ultra.spd[0];
					if ('rech' in this.ultra) this.data.rech -= this.ultra.rech[0];
					if ('cost' in this.ultra) this.data.cost -= this.ultra.cost[0];
				}
			}

			// creates and returns an array of the cat's trait icons/toggles
			createTraits() {
				let result = [];
				for (let i = 0; i < traitList.length; i++) {
					let t = traitList[i];
					let $elem = $traits[i].clone();
					if (!this.data.targets.includes(t)) {
						$elem.addClass('trait-disabled');
					} else {
						if (this.talentMode >= 1 && t in this.talents) {
							$elem.addClass('trait-talented');
						} else if (this.talentMode >= 2 && t in this.ultra) {
							$elem.addClass('trait-ultra');
						}
					}
					if (this.traitToggles[i]) {
						$elem.children('input').prop('checked', true);
					}
					result.push($elem);

					// events
					$elem.children('input').on({
						'click': (e) => {
							const $input = $(e.target);
							const val = $input.attr('value');
							const bool = $input.is(':checked');
							const index = traitList.indexOf(val);
							if (this.traitToggles[index] === 0) return;
							this.traitToggles[index] = bool;
							this.calculate();
						},
						'contextmenu': (e) => {
							e.preventDefault();
							const $input = $(e.target);
							const val = $input.attr('value');
							const bool = !$input.is(':checked');
							if (val == 'metal') {
								for (const cat of catList) {
									if (!(cat.selected || noSelection)) continue;
									cat.traitToggles[3] = bool;
									cat.calculate();
								}
							} else {
								const index = traitList.indexOf(val);
								for (const cat of catList) {
									if (!(cat.selected || noSelection)) continue;
									if (cat.traitToggles[index] === 0) {
										if (cat.selectedTrait !== '') {
											cat.traitToggles[traitList.indexOf(cat.selectedTrait)] = false;
										}
										continue;
									}
									cat.traitToggles[index] = bool;
									cat.calculate();
								}
							}
						}
					});
				}
				return result;
			}

			// creates and returns an array of the cat's ability icons
			createAbilities() {
				this.abilities = {};
				const effectElements = [];
				const abilityExclusives = [];
				for (const ability in this.data.abilities) {
					if (!(ability in data_AbilityExplanations)) continue;
					this.abilities[ability] = new Ability(this, ability);
					if (effects.includes(ability)) {
						effectElements.push(this.abilities[ability]);
					} else {
						abilityExclusives.push(this.abilities[ability]);
					}
				}
				return [effectElements, abilityExclusives];
			}

			// updates existing ability icons based on stored data
			updateAbilities() {
				if (!this.loaded) return;
				// sort abilities to update, to remove, and to add
				const all = new Set(Object.keys(this.abilities).concat(Object.keys(this.data.abilities)));
				const [shared, newAbilities, oldAbilities] = [[], [], []];
				for (const a of [...all]) {
					if ((a in this.abilities) && !(a in this.data.abilities)) {
						oldAbilities.push(a);
					} else if (!(a in this.abilities) && (a in this.data.abilities)) {
						newAbilities.push(a);
					} else {
						shared.push(a);
					}
				}
				// update the sorted abilities
				for (const ability of shared) {
					const abilityParams = JSON.parse(JSON.stringify(this.data.abilities[ability]));
					this.abilities[ability].update();
				}
				for (const ability of oldAbilities) {
					this.abilities[ability].remove();
					delete this.abilities[ability];
				}
				for (const ability of newAbilities) {
					if (!(ability in data_AbilityExplanations)) continue;
					const $newIcon = new Ability(this, ability);
					$newIcon.appendTo(effects.includes(ability) ? this.cells.effects : this.cells.abilities);
					this.abilities[ability] = $newIcon;
				}
			}

			// recalculates stats and updates necessary cells
			calculate() {
				const newLevel = numericLevel(this.getLevel());
				let [newHP, newHPExp, newHPMax] = this.calcHealth();
				let [newATK, newATKExp, newATKMax] = this.calcDamage();
				let [newDPS, newDPSExp, newDPSMax] = [this.calcDPS(newATK), this.calcDPS(newATKExp), this.calcDPS(newATKMax)];
				let newSpd = Math.floor(this.data.spd * (1 + getComboTotal('Speed')));
				let newRech = this.data.rech - getComboTotal('Research');
				if (newRech < 60) newRech = 60;
				const colInfo = [
					['hp', newHP],
					['hpExp', newHPExp],
					['hpMax', newHPMax],
					['atk', newATK],
					['atkExp', newATKExp],
					['atkMax', newATKMax],
					['dps', newDPS],
					['dpsExp', newDPSExp],
					['dpsMax', newDPSMax],
					['frequency', this.data.freq],
					['tba', this.data.tba],
					['speed', newSpd],
					['recharge', newRech],
					['cost', this.data.cost]
				];
				for (const col of colInfo) {
					this.cellSortValues[col[0]] = col[1];
				}
				if (this.loaded) {
					const updatedCellInfo = [
						['hp', newHP],
						['hpExp', newHPExp],
						['hpMax', newHPMax],
						['atk', newATK],
						['atkExp', newATKExp],
						['atkMax', newATKMax],
						['dps', newDPS],
						['dpsExp', newDPSExp],
						['dpsMax', newDPSMax],
						['frequency', `${toDisplayString(this.data.freq)}f<sup>${framesToSeconds(this.data.freq)}s</sup>`, this.data.freq],
						['tba', `${toDisplayString(this.data.tba)}f<sup>${framesToSeconds(this.data.tba)}s</sup>`, this.data.tba],
						['speed', newSpd],
						['recharge', `${toDisplayString(newRech)}f<sup>${framesToSeconds(newRech)}s</sup>`, newRech],
						['cost', `${toDisplayString(this.data.cost)}¢`, this.data.cost]
					];
					for (const cellInfo of updatedCellInfo) {
						this.updateCell(...cellInfo);
					}
				}
			}

			// calculate the cat's hp accounting for abilities
			calcHealth() {
				const base = this.data.hp;
				const abilities = this.data.abilities;
				let talentBuff = 1;
				if (this.talentMode >= 1 && 'hp' in this.talents) {
					talentBuff *= 1 + this.talents.hp[0] / 100;
				}
				if (this.talentMode >= 2 && 'hp' in this.ultra) {
					talentBuff *= 1 + this.ultra.hp[0] / 100;
				}
				let stat = Math.round(this.levelScale(base) * talentBuff * (1 + getComboTotal('Defense')));
				const fruitTreasures = this.fruit == 1;
				if (this.data.targets.includes(this.selectedTrait)) {
					if ('strong' in abilities) {
						stat *= fruitTreasures ? 2.5 : 2;
						stat /= 1 - 0.02 * this.orbData.strong;
						stat /= 1 - getComboTotal('Strong');
					}
					if ('resistant' in abilities) {
						stat *= fruitTreasures ? 5 : 4;
						stat /= 1 - 0.05 * this.orbData.resist;
						stat /= 1 - getComboTotal('Resistant');
					}
					if ('insanely-tough' in abilities) {
						stat *= fruitTreasures ? 7 : 6;
					}
				}
				if (this.abilityEnabled('colossus-slayer') || this.orbData.colossus >= 1) {
					stat /= 1 - (this.abilityEnabled('colossus-slayer') ? 0.3 : 0);
					stat /= 1 - (this.abilityEnabled('colossus-slayer') ? 0 : orbColHPMod[this.orbData.colossus]);
				}
				if (this.abilityEnabled('behemoth-slayer')) {
					stat /= 0.6;
				}
				if (this.abilityEnabled('sage-slayer')) {
					stat /= 0.5;
				}
				stat /= 1 - 0.04 * this.orbData.defense;
				stat *= orbSolMultipliers[this.orbData.sol];
				stat /= 1 - 0.0075 * foundationLevel;
				let expected = stat; // with abilities
				let max = stat; // maximum health from abilities
				if (this.data.targets.includes(this.selectedTrait) && 'weaken' in abilities) {
					let cov = this.calcUptime(abilities.weaken[0] / 100, Math.floor(abilities.weaken[1] * (1 + getComboTotal('Weaken')) * (fruitTreasures ? 1.2 : 1)));
					let covMax = this.calcUptime(1, Math.floor(abilities.weaken[1] * (1 + getComboTotal('Weaken')) * (fruitTreasures ? 1.2 : 1)));
					expected *= 1 + cov * (100 / abilities.weaken[3] - 1);
					max *= 1 + covMax * (100 / abilities.weaken[3] - 1);
				}
				return [Math.floor(stat), Math.floor(expected), Math.floor(max)];
			}

			// calculate the cat's damage accounting for abilities
			calcDamage(multi = false, range = NaN) {
				const notGraph = isNaN(range);
				if (notGraph) range = this.data.rng;
				if (this.selectedTrait == 'metal') return this.calcMetalDamage(multi, range);
				const base = this.data.ap;
				const abilities = this.data.abilities;
				let hits = [base];
				if ('multi-hit' in abilities) {
					hits = [abilities['multi-hit'][0], abilities['multi-hit'][4], abilities['multi-hit'][8]];
					if (hits[2] == 0) {
						hits = hits.slice(0, 2);
					}
				}
				let ranges;
				if ('mult-ranges' in this.data) {
					ranges = [...this.data['mult-ranges']];
					if (notGraph) {
						for (let i = 1; i < ranges.length; i++) {
							if (ranges[i - 1][1] >= ranges[i][0] && ranges[i - 1][1] - ranges[i][0] < multiOverlapThreshold) {
								ranges[i] = [ranges[i - 1][1] + 1, ranges[i][1]];
							}
						}
					}
				} else {
					ranges = new Array(hits.length);
					ranges.fill(this.getHitRange());
				}
				let expected = []; // with abilities
				let additional = []; // wave, surge, explosion, and orb damage
				let max = []; // maximum damage from abilities
				let additionalMax = []; // additional max damage from wave, surge, explosion
				for (let i = 0; i < hits.length; i++) {
					const hitBase = hits[i];
					const orbDamage = hitBase * this.orbData.attack;
					let talentBuff = 1;
					if (this.talentMode >= 1 && 'ap' in this.talents) {
						talentBuff *= 1 + this.talents.ap[0] / 100;
					}
					if (this.talentMode >= 2 && 'ap' in this.ultra) {
						talentBuff *= 1 + this.ultra.ap[0] / 100;
					}
					hits[i] = Math.round(this.levelScale(hits[i]) * talentBuff * (1 + getComboTotal('Attack')) * orbSolMultipliers[this.orbData.sol]);
					expected.push(0);
					additional.push(0);
					max.push(0);
					additionalMax.push(0);
					if (this.data.targets.includes(this.selectedTrait)) {
						const fruitTreasures = this.fruit == 1;
						if ('strong' in abilities) {
							hits[i] *= (fruitTreasures ? 1.8 : 1.5) + 0.06 * this.orbData.strong;
							hits[i] *= 1 + getComboTotal('Strong');
						}
						if ('massive-damage' in abilities) {
							hits[i] *= (fruitTreasures ? 4 : 3) + 0.1 * this.orbData.massive;
							hits[i] *= 1 + getComboTotal('Massive Damage');
						}
						if ('insane-damage' in abilities) {
							hits[i] *= fruitTreasures ? 6 : 5;
						}
					}
					if (this.abilityEnabled('strengthen')) {
						hits[i] *= 1 + (abilities.strengthen[1] + getComboTotal('Strengthen')) / 100;
					}
					if (this.abilityEnabled('colossus-slayer') || this.orbData.colossus >= 1) {
						hits[i] *= 1 + (this.abilityEnabled('colossus-slayer') ? 0.6 : 0);
						hits[i] *= 1 + orbColAPMod[this.orbData.colossus];
					}
					if (this.abilityEnabled('behemoth-slayer')) {
						hits[i] *= 2.5;
					}
					if (this.abilityEnabled('sage-slayer')) {
						hits[i] *= 1.2;
					}
					expected[i] = hits[i];
					max[i] = hits[i];
					if (!('multi-hit' in abilities) || abilities['multi-hit'][i * 4 + 3]) {
						if ('critical' in abilities) {
							expected[i] *= (abilities.critical[0] + getComboTotal('Critical')) / 100 + 1;
							max[i] *= 2;
						}
						if ('savage-blow' in abilities) {
							expected[i] *= 2 * abilities['savage-blow'][0] / 100 + 1;
							max[i] *= 3;
						}
						if (this.abilityEnabled('wave')) {
							const waveRange = [-67.5, 132.5 + abilities.wave[1] * 200];
							if (waveRange[0] <= range && range <= waveRange[1]) {
								additional[i] += (expected[i] + orbDamage) * (abilities.wave[0] / 100);
								additionalMax[i] += max[i] + orbDamage;
							}
						}
						if (this.abilityEnabled('mini-wave')) {
							const miniWaveRange = [-67.5, 132.5 + abilities['mini-wave'][1] * 200];
							if (miniWaveRange[0] <= range && range <= miniWaveRange[1]) {
								additional[i] += (expected[i] / 5 + orbDamage) * (abilities['mini-wave'][0] / 100);
								additionalMax[i] += max[i] / 5 + orbDamage;
							}
						}
						if (this.abilityEnabled('surge')) {
							additional[i] += (expected[i] + orbDamage) * abilities.surge[3] * calcSurgeProb(range, abilities.surge.slice(1, 3)) * (abilities.surge[0] / 100);
							additionalMax[i] += (max[i] + orbDamage) * abilities.surge[3];
						}
						if (this.abilityEnabled('mini-surge')) {
							additional[i] += (expected[i] / 5 + orbDamage) * abilities['mini-surge'][3] * calcSurgeProb(range, abilities['mini-surge'].slice(1, 3)) * (abilities['mini-surge'][0] / 100);
							additionalMax[i] += (max[i] / 5 + orbDamage) * abilities['mini-surge'][3];
						}
						if (this.abilityEnabled('explosion')) {
							additional[i] += (expected[i] * calcExplosionMultiplier(range, abilities.explosion[1]) + orbDamage) * (abilities.explosion[0] / 100);
							additionalMax[i] += max[i] * calcExplosionMultiplier(range, abilities.explosion[1]) + orbDamage;
						}
					}
					hits[i] += orbDamage;
					expected[i] += additional[i] + orbDamage;
					max[i] += additionalMax[i] + orbDamage;
					if (notInRange(range, ranges[i])) {
						if (!multi) hits[i] = 0;
						expected[i] = additional[i];
						max[i] = additionalMax[i];
					}
				}
				if (multi) return hits;
				return [sum(hits), sum(expected), sum(max)];
			}

			// calculates damage against a metal enemy
			calcMetalDamage(multi = false, range = this.data.rng) {
				const base = this.data.ap;
				const abilities = this.data.abilities;
				let hits = [base];
				if ('multi-hit' in abilities) {
					hits = [abilities['multi-hit'][0], abilities['multi-hit'][4], abilities['multi-hit'][8]];
					if (hits[2] == 0) hits.pop();
				}
				let ranges;
				if ('mult-ranges' in this.data) {
					ranges = [...this.data['mult-ranges']];
					if (notGraph) {
						for (let i = 1; i < ranges.length; i++) {
							if (ranges[i - 1][1] >= ranges[i][0] && ranges[i - 1][1] - ranges[i][0] < multiOverlapThreshold) {
								ranges[i] = [ranges[i - 1][1] + 1, ranges[i][1]];
							}
						}
					}
				} else {
					ranges = new Array(hits.length);
					ranges.fill(this.getHitRange());
				}
				let expected = []; // with abilities
				let additional = []; // wave, surge, explosion
				let max = []; // maximum damage from abilities
				let additionalMax = []; // additional max damage from wave, surge, explosion
				for (let i = 0; i < hits.length; i++) {
					hits[i] = this.levelScale(hits[i]);
					expected.push(1);
					additional.push(0);
					max.push(1);
					additionalMax.push(0);
					if ('critical' in abilities) {
						expected[i] = (hits[i] * 2 - 1) * ((abilities.critical[0] + getComboTotal('Critical')) / 100) + 1;
						max[i] = hits[i] * 2;
						if (this.abilityEnabled('strengthen')) {
							expected[i] *= 1 + (abilities.strengthen[1] + getComboTotal('Strengthen')) / 100;
							max[i] *= 1 + (abilities.strengthen[1] + getComboTotal('Strengthen')) / 100;
						}
						if ('savage-blow' in abilities) {
							expected[i] *= 1 + abilities['savage-blow'][0] / 50;
							max[i] *= 3;
						}
						if (this.data.targets.includes('metal')) {
							if ('strong' in abilities) {
								expected[i] *= 1.8 * (1 + getComboTotal('Strong'));
								max[i] *= 1.8 * (1 + getComboTotal('Strong'));
							}
							if ('massive-damage' in abilities) {
								expected[i] *= 4 * (1 + getComboTotal('Massive Damage'));
								max[i] *= 4 * (1 + getComboTotal('Massive Damage'));
							}
							if ('insane-damage' in abilities) {
								expected[i] *= 6;
								max[i] *= 6;
							}
						}
					}
					if (this.abilityEnabled('wave')) {
						const waveRange = [-67.5, 132.5 + abilities.wave[1] * 200];
						if (waveRange[0] <= range && range <= waveRange[1]) {
							additional[i] += expected[i] * (abilities.wave[0] / 100);
							additionalMax[i] += max[i];
						}
					}
					if (this.abilityEnabled('mini-wave')) {
						const miniWaveRange = [-67.5, 132.5 + abilities['mini-wave'][1] * 200];
						if (miniWaveRange[0] <= range && range <= miniWaveRange[1]) {
							additional[i] += expected[i] / 5 * (abilities['mini-wave'][0] / 100);
							additionalMax[i] += max[i] / 5;
						}
					}
					if (this.abilityEnabled('surge')) {
						additional[i] += expected[i] * abilities.surge[3] * calcSurgeProb(range, abilities.surge.slice(1, 3)) * (abilities.surge[0] / 100);
						additionalMax[i] += max[i] * abilities.surge[3];
					}
					if (this.abilityEnabled('mini-surge')) {
						additional[i] += expected[i] / 5 * abilities['mini-surge'][3] * calcSurgeProb(range, abilities['mini-surge'].slice(1, 3)) * (abilities['mini-surge'][0] / 100);
						additionalMax[i] += max[i] / 5 * abilities['mini-surge'][3];
					}
					if (this.abilityEnabled('explosion')) {
						additional[i] += expected[i] * calcExplosionMultiplier(range, abilities.explosion[1]) * (abilities.explosion[0] / 100);
						additionalMax[i] += max[i] * calcExplosionMultiplier(range, abilities.explosion[1]);
					}
					if (!multi) hits[i] = 1;
					expected[i] += additional[i];
					max[i] += additionalMax[i];
					if (notInRange(range, ranges[i])) {
						if (!multi) hits[i] = 0;
						expected[i] = additional[i];
						max[i] = additionalMax[i];
					}
				}
				if (multi) return hits;
				return [sum(hits), sum(expected), sum(max)];
			}

			// get the unit's hit range
			getHitRange() {
				let range = [-320, this.data.rng];
				if ('omni' in this.data.abilities) {
					range = [this.data.abilities.omni[0], this.data.abilities.omni[1]];
				} else if ('long' in this.data.abilities) {
					range = [this.data.abilities.long[0], this.data.abilities.long[1]];
				}
				if ('mult-ranges' in this.data) {
					range = [Math.min(...this.data['mult-ranges'].map(a => a[0])), Math.max(...this.data['mult-ranges'].map(a => a[1]))];
				}
				return range;
			}

			// calculate dps the unit's DPS (using recharge instead for kamikaze)
			calcDPS(atk) {
				const freq = 'kamikaze' in this.data.abilities ? this.data.rech - getComboTotal('Research') : this.data.freq;
				return Math.round(atk / freq * 30 * Math.pow(10, decimalPoints)) / Math.pow(10, decimalPoints);
			}

			// calculates the given stat scaled up to the cat's level
			levelScale(base) {
				const growth = this.data.grow;
				const level = numericLevel(this.getLevel());
				let result = base;
				let prop, index;
				for (let i = 2; i <= level; i++) {
					index = Math.ceil(i / 10) - 1;
					prop = growth[index >= growth.length ? growth.length - 1 : index] / 100;
					result += base * prop;
				}
				return Math.floor(Math.round(result) * (1 + 0.5 * Math.floor(300 / 100)));
			}

			// calculates the proportion of time which an ability is active given probability and duration
			calcUptime(chance, duration) {
				// define short variable names
				const p = chance;
				let d = duration;
				const f = 'kamikaze' in this.data.abilities ? this.data.rech : this.data.freq;
				const u = d / f;
				const q = 1 - p;
				// apply wave, surge, explosion as duration increase
				const extra = [];
				if (this.abilityEnabled('wave')) {
					extra.push(Math.trunc(this.data.rng / 200) * 10 + 10);
				}
				if (this.abilityEnabled('mini-wave')) {
					extra.push(10);
				}
				if (this.abilityEnabled('surge')) {
					extra.push((15 + 20 * (this.data.abilities.surge[3] - 1)) * (this.data.abilities.surge[0] / 100) * calcSurgeProb(this.data.rng, this.data.abilities.surge.slice(1, 3)));
				}
				if (this.abilityEnabled('mini-surge')) {
					extra.push((15 + 20 * (this.data.abilities['mini-surge'][3] - 1)) * (this.data.abilities['mini-surge'][0] / 100) * calcSurgeProb(this.data.rng, this.data.abilities['mini-surge'].slice(1, 3)));
				}
				if (this.abilityEnabled('explosion')) {
					extra.push(this.data.abilities.explosion[0] / 10);
				}
				if (extra.length > 0) d += Math.max(...extra);
				// find all hits and their delays
				let hits = [this.data.fore];
				if ('multi-hit' in this.data.abilities) {
					hits = [this.data.abilities['multi-hit'][1], this.data.abilities['multi-hit'][5]];
					if (this.data.abilities['multi-hit'][8] != 0) {
						hits.push(this.data.abilities['multi-hit'][9]);
					}
					for (let i = hits.length - 1; i >= 0; i--) {
						if (!this.data.abilities['multi-hit'][i * 4 + 3]) hits.splice(i, 1);
					}
				}
				const hitsOriginal = [];
				for (let i = hits.length - 1; i >= 0; i--) {
					hitsOriginal.unshift(hits[i]);
					hits[i] -= hits[0];
				}
				// remove any hits that don't actually hit standing range
				if ('mult-ranges' in this.data) {
					if (notInRange(this.data.rng, this.data['mult-ranges'][2])) {
						hits.pop();
					}
					if (notInRange(this.data.rng, this.data['mult-ranges'][1])) {
						hits.splice(1, 1);
					}
				}
				const h = hits.length;
				// for multi-hit
				if (h > 1) {
					if (h == 2 && u < 3) {
						// 2 hits with any chance but less than 300% d / f
						const diff = hits[1] - hits[0];
						let reset = p;
						const lost = [Math.max(d - f, 0), Math.max(d - f + diff, 0)];
						const weighted = [lost[0] * reset, lost[1] * reset];
						for (let cycle = 0; cycle <= 2; cycle++) {
							for (let hit = 0; hit <= 1; hit++) {
								if (cycle == 0 && hit == 0) continue;
								reset *= q;
								const prevHit = hitsOriginal[1 - hit] + f * (cycle + Math.min(hit - 1, 0));
								const currHit = hitsOriginal[hit] + f * cycle;
								[lost[0], lost[1]] = [Math.max(lost[0] + prevHit - currHit, 0), Math.max(lost[1] + prevHit - currHit, 0)];
								weighted[0] += lost[0] * reset;
								weighted[1] += lost[1] * reset;
							}
						}
						const cases = [p * q, p * q, p ** 2];
						const uptime = [d, d, d + diff];
						uptime[0] -= weighted[0];
						uptime[1] -= weighted[1];
						uptime[2] -= weighted[1];
						let total = 0;
						for (let i = 0; i < 3; i++) {
							total += cases[i] * uptime[i];
						}
						return total / f;
					} else if (h == 3) {
						// 3 hits with 100% chance
						if (p == 1) {
							let sum = 0;
							sum += d > hits[1] ? hits[1] : d;
							sum += d > hits[2] - hits[1] ? hits[2] - hits[1] : d;
							sum += d > f - hits[2] ? f - hits[2] : d;
							return sum / f;
						}
						// 3 hits with any chance but less than 300% d / f
						if (u < 3) {
							const diff = [hits[1] - hits[0], hits[2] - hits[1], hits[2] - hits[0]];
							let reset = p;
							const lost = [Math.max(d - f, 0), Math.max(d - f + diff[0], 0), Math.max(d - f + diff[2], 0)];
							const weighted = [lost[0] * reset, lost[1] * reset, lost[2] * reset];
							for (let cycle = 0; cycle <= 2; cycle++) {
								for (let hit = 0; hit <= 2; hit++) {
									if (cycle == 0 && hit == 0) continue;
									reset *= q;
									const prevHit = hitsOriginal[(hit + 2) % 3] + f * (cycle + Math.min(hit - 1, 0));
									const currHit = hitsOriginal[hit] + f * cycle;
									[lost[0], lost[1], lost[2]] = [Math.max(lost[0] + prevHit - currHit, 0), Math.max(lost[1] + prevHit - currHit, 0), Math.max(lost[2] + prevHit - currHit, 0)];
									weighted[0] += lost[0] * reset;
									weighted[1] += lost[1] * reset;
									weighted[2] += lost[2] * reset;
								}
							}
							const cases = [
								p * q ** 2,
								p * q ** 2,
								p ** 2 * q,
								p * q ** 2,
								p ** 2 * q,
								p ** 2 * q,
								p ** 3
							];
							const uptime = [
								d,
								d,
								diff[0] < d ? d + diff[0] : d * 2,
								d,
								diff[2] < d ? d + diff[2] : d * 2,
								diff[1] < d ? d + diff[1] : d * 2,
								diff[0] < d && diff[1] < d ? d + diff[2] : (diff[0] >= d && diff[1] < d ? d * 2 + diff[1] : (diff[0] < d && diff[1] >= d ? d * 2 + diff[0] : d * 3))
							];
							uptime[0] -= weighted[0];
							uptime[1] -= weighted[1];
							uptime[2] -= weighted[1];
							uptime[3] -= weighted[2];
							uptime[4] -= weighted[2];
							uptime[5] -= weighted[2];
							uptime[6] -= weighted[2];
							let total = 0;
							for (let i = 0; i < 7; i++) {
								total += cases[i] * uptime[i];
							}
							return total / f;
						}
					}
					// other cases (approximation)
					const P = 1 - Math.pow(q, h);
					return 1 + Math.pow(1 - P, Math.floor(u)) * (u % 1 * P - 1);
				}
				// no multi-hit
				if (u <= 1) {
					return p * u;
				}
				return 1 + Math.pow(q, Math.floor(u)) * (u % 1 * p - 1);
			}

			// plots the DPS graph
			plotDPSGraph() {
				$graphCanvas.removeClass('graph-empty');
				$graphClear.prop('disabled', false);
				// get min and max ranges
				const range = this.getHitRange();
				if ('wave' in this.data.abilities) {
					const waveRange = 132.5 + this.data.abilities.wave[1] * 200;
					if (waveRange > range[1]) range[1] = Math.floor(waveRange);
					if (range[0] > -67.5) range[0] = -67;
				}
				if ('mini-wave' in this.data.abilities) {
					const miniWaveRange = 132.5 + this.data.abilities['mini-wave'][1] * 200;
					if (miniWaveRange > range[1]) range[1] = Math.floor(miniWaveRange);
					if (range[0] > -67.5) range[0] = -67;
				}
				if ('surge' in this.data.abilities) {
					const surgeRange = [this.data.abilities.surge[1] - 250, this.data.abilities.surge[2] + 125];
					if (surgeRange[1] > range[1]) range[1] = surgeRange[1];
					if (surgeRange[0] < range[0]) range[0] = surgeRange[0];
				}
				if ('mini-surge' in this.data.abilities) {
					const miniSurgeRange = [this.data.abilities['mini-surge'][1] - 250, this.data.abilities['mini-surge'][2] + 125];
					if (miniSurgeRange[1] > range[1]) range[1] = miniSurgeRange[1];
					if (miniSurgeRange[0] < range[0]) range[0] = miniSurgeRange[0];
				}
				if ('explosion' in this.data.abilities) {
					const explosionRange = [this.data.abilities.explosion[1] - 275, this.data.abilities.explosion[1] + 275];
					if (explosionRange[1] > range[1]) range[1] = explosionRange[1];
					if (explosionRange[0] < range[0]) range[0] = explosionRange[0];
				}
				// add graph data
				const data = [];
				for (let r = range[0]; r <= range[1]; r++) {
					data.push([r, this.calcDPS(this.calcDamage(false, r)[1])]);
				}
				graphData.push(data);
				graphNames.push(this.data.name);
				updateChart();
			}

			// replaces self with a new cat object
			switchForm() {
				const cat = new Cat(data_CatData[(this.index + 1) % data_CatData.length].id != this.data.id ? this.index - this.data.form : this.index + 1);
				cat.createHTML(this.$row);
				catList[catList.indexOf(this)] = cat;
			}

			// turns on/off talents and updates the stored data (actual changes in UI are elsewhere)
			talentHandler() {
				this.talentMode = (this.talentMode + 1) % ($.isEmptyObject(this.ultra) ? 2 : 3);
				this.updateStats();
				const talentsOn = this.talentMode >= 1;
				const ultraOn = this.talentMode >= 2;
				const talentDataArray = [this.talents, this.ultra];
				const boolArray = [talentsOn, ultraOn];
				for (let i = 0; i < 2; i++) {
					const data = talentDataArray[i];
					const bool = boolArray[i];
					for (const ability in data) {
						if (ability in traitIcons) {
							if (bool) {
								if (!this.data.targets.includes(ability)) this.data.targets.push(ability);
								this.traitToggles[traitList.indexOf(ability)] = false;
							} else if (this.data.targets.includes(ability)) {
								this.data.targets.splice(this.data.targets.indexOf(ability), 1);
								this.traitToggles[traitList.indexOf(ability)] = 0;
							}
						} else {
							if (bool) {
								this.data.abilities[ability] = data[ability];
							} else {
								if (ability in this.initialData.abilities) {
									this.data.abilities[ability] = this.initialData.abilities[ability];
								} else if (ability in this.data.abilities) {
									delete this.data.abilities[ability];
								}
							}
						}
					}
				}
				if (this.loaded) {
					this.$talentToggle
						.removeClass('talents-off talents-on talents-ultra')
						.addClass(['talents-off', 'talents-on', 'talents-ultra'][this.talentMode]);
					for (let i = 0; i < this.traitIcons.length; i++) {
						if (this.data.targets.includes(traitList[i])) {
							this.traitIcons[i].removeClass('trait-disabled');
							if (this.talentMode >= 1 && traitList[i] in this.talents) {
								this.traitIcons[i].addClass('trait-talented');
							} else if (this.talentMode >= 2 && traitList[i] in this.ultra) {
								this.traitIcons[i].addClass('trait-ultra');
							} else {
								this.traitIcons[i].removeClass('trait-talented trait-ultra');
							}
						} else {
							this.traitIcons[i].addClass('trait-disabled');
							this.traitIcons[i].removeClass('trait-talented trait-ultra');
						}
					}
				}
				this.calculate();
				this.updateAbilities();
			}

			// turns on the orb menu
			orbHandler(e) {
				const $target = $(e.target);
				orbMenu = true;
				$orbFooter.show();
				$tableFooter.hide();
				$('.cat-stats-tool__orb.active').removeClass('active');
				$target.addClass('active');
				$(`input[type='radio'][name='orb-effect'][value='${$target.attr('data-effect')}']`).prop('checked', true);
				$(`input[type='radio'][name='orb-grade'][value='${$target.attr('data-grade')}']`).prop('checked', true);
				$("input[type='radio'][name='orb-effect']").prop('disabled', false);
				if (!('strong' in this.data.abilities)) {
					$("input[type='radio'][name='orb-effect'][value='strong']").prop('disabled', true);
				}
				if (!('massive-damage' in this.data.abilities)) {
					$("input[type='radio'][name='orb-effect'][value='massive']").prop('disabled', true);
				}
				if (!('resistant' in this.data.abilities)) {
					$("input[type='radio'][name='orb-effect'][value='resist']").prop('disabled', true);
				}
				$("input[type='radio'][name='orb-effect'][value='colossus']").prop('disabled', this.cells.orb.has('.cat-stats-tool__orb:not(.empty)[data-effect="colossus"]').length > 0);
				$("input[type='radio'][name='orb-effect'][value='sol']").prop('disabled', this.cells.orb.has('.cat-stats-tool__orb:not(.empty)[data-effect="sol"]').length > 0);
			}

			// updates orb data and recalculates stats
			updateOrbData() {
				this.orbData = {
					'attack': 0,
					'defense': 0,
					'strong': 0,
					'massive': 0,
					'resist': 0,
					'colossus': 0,
					'sol': 0
				};
				for (const o of this.orbs) {
					if (!o) continue;
					this.orbData[o.effect] += orbGrades.indexOf(o.grade) + 1;
				}
				this.calculate();
			}

			// adds a new td element to self
			addCell(name, contentHTML, sortValue = undefined) {
				const $newCell = statsPlaceholder.clone()
					.addClass(`cat-stats-tool__cell-${name}`)
					.appendTo(this.$row);
				this.cells[name] = $newCell;
				if (Object.values(toggleableColumns).includes(name) && !colSettings.has(name)) $newCell.addClass('col-hidden');

				if (contentHTML.constructor === Array) {
					for (const i of contentHTML) {
						i.appendTo($newCell);
					}
				} else if (typeof contentHTML === 'number') {
					$newCell
						.attr({
							'data-sort': contentHTML,
							'title': 'Click to copy value'
						})
						.text(contentHTML.toLocaleString(undefined, { maximumFractionDigits: decimalPoints }));
				} else {
					$newCell.html(contentHTML);
					if (sortValue) {
						$newCell.attr({
							'data-sort': sortValue,
							'title': 'Click to copy value'
						});
					}
				}
			}

			// replaces the specified cell's content with the given html
			updateCell(name, contentHTML, sortValue = undefined) {
				const $cell = this.cells[name];
				if (contentHTML.constructor === Array) {
					$cell.empty();
					for (const i of contentHTML) {
						i.appendTo($cell);
					}
				} else if (typeof contentHTML === 'number') {
					$cell
						.attr('data-sort', contentHTML)
						.text(toDisplayString(contentHTML));
				} else {
					if (contentHTML == $cell.prop('innerHTML')) return;
					$cell.html(contentHTML);
					if (sortValue) $cell.attr('data-sort', sortValue);
				}
			}

			// returns whether the given ability is enabled
			abilityEnabled(ability) {
				return !(ability in this.data.abilities) ? false : this.abilityToggles[ability];
			}

			// returns the level set in the row's level input
			getLevel() {
				if (!this.loaded) return this.defaultLevel;
				return this.$levelInput.val();
			}

			// when selected
			select() {
				this.selected = true;
				if (this.loaded) this.$row.addClass('cat-selected');
			}

			// when selection is removed
			unselect() {
				this.selected = false;
				if (this.loaded) this.$row.removeClass('cat-selected');
			}

			// adds itself to the table
			add() {
				if (!this.loaded) {
					this.createHTML();
				}
				$tableBody.append(this.$row);
			}

			// duplicates itself in the table
			duplicate() {
				const newCat = new Cat(this.index, JSON.parse(JSON.stringify({
					'level': this.getLevel(),
					'trait': this.selectedTrait,
					'abilities': this.abilityToggles,
					'talent': this.talentMode,
					'orbs': this.orbs,
					'orbData': this.orbData
				})));
				newCat.order = this.order + 1;
				const index = catList.indexOf(this);
				for (const cat of catList.slice(index)) {
					cat.order++;
				}
				catList.splice(index + 1, 0, newCat);
				if (catList.length < (currentPage + 1) * rowsPerPage && catList.length >= currentPage * rowsPerPage) {
					newCat.createHTML();
					newCat.$row.insertAfter(this.$row);
					$spaceRow.clone().insertAfter(this.$row);
					cleanSpaces();
				}
				showCurrentPage();
				paginate();
			}

			// removes itself from the table
			remove() {
				if (this.loaded) this.$row.detach();
			}

			// deletes itself
			delete() {
				if (this.loaded) this.$row.detach();
				catList.splice(catList.indexOf(this), 1);
				cleanSpaces();
				paginate();
			}

			// compresses itself into a base64 string for url
			compress() {
				const values = [this.data.id, this.data.form, numericLevel(this.getLevel())];
				values.push(this.selectedTrait === '' ? traitList.length : traitList.indexOf(this.selectedTrait));
				for (const ability in this.abilityToggles) {
					values.push(+this.abilityToggles[ability]);
				}
				values.push(this.talentMode);
				for (const orb of this.orbs) {
					if (orb) {
						values.push(orbEffects.indexOf(orb.effect), orbGrades.indexOf(orb.grade));
					} else {
						values.push(7, 0);
					}
				}
				let value = '';
				for (let i = 0; i < values.length; i++) {
					value += values[i].toString(2).padStart(compressionBits[i], '0');
				}
				return Base64.fromNumber(parseInt(value, 2));
			}
		}

		// represents a cat's ability
		class Ability {
			constructor(cat, ability) {
				// properties
				this.cat = cat;
				this.ability = ability;
				this.info = data_AbilityExplanations[ability];
				this.desc = this.makeDescription();
				// create html
				this.$abilityContainer = $('<div>')
					.attr('data-ability', ability)
					.addClass('cat-stats-tool__ability-container');
				if (ability in cat.ultra && cat.talentMode >= 2) {
					this.$abilityContainer.addClass('ability-ultra');
				} else if (ability in cat.talents && cat.talentMode >= 1) {
					this.$abilityContainer.addClass('ability-talented');
				}
				const $iconImage = $('<img>')
					.addClass('cat-stats-tool__ability-icon')
					.attr({
						'src': this.info.icon,
						'loading': 'lazy',
						'decoding': 'async',
						'width': rowIconSize,
						'height': rowIconSize
					})
					.appendTo(this.$abilityContainer);
				// if the ability is toggleable
				this.toggle = ability in toggleableAbilities;
				if (this.toggle) {
					this.$abilityContainer
						.on('contextmenu', (e) => {
							e.preventDefault();
							const bool = cat.abilityToggles[ability];
							for (const cat of catList) {
								if (!(cat.selected || noSelection) || !(this.ability in cat.data.abilities)) continue;
								cat.abilityToggles[this.ability] = !bool;
								cat.calculate();
								cat.updateAbilities();
							}
						});
					if (!cat.abilityToggles[ability]) {
						this.$abilityContainer.addClass('ability-disabled');
					}
					if (mobileControls) {
						this.$abilityContainer.on('click', () => {
							if (doubleTapped) {
								const bool = this.cat.abilityToggles[this.ability];
								this.cat.abilityToggles[this.ability] = !bool;
								cat.calculate();
								cat.updateAbilities();
							}
							doubleTapped = true;
							setTimeout(() => {
								doubleTapped = false;
							}, doubleTapLength);
						});
					} else {
						this.$abilityContainer.on('click', () => {
							const bool = this.cat.abilityToggles[this.ability];
							this.cat.abilityToggles[this.ability] = !bool;
							cat.calculate();
							cat.updateAbilities();
						});
					}
				}
				// events
				if (mobileControls) {
					this.$abilityContainer.on('click', () => {
						if (this.$abilityContainer.hasClass('ability-viewing')) {
							if (orbMenu) {
								$tableFooter.hide();
								$orbFooter.show();
							}
							showDetails();
							this.$abilityContainer.removeClass('ability-viewing');
						} else {
							$tableFooter.show();
							$orbFooter.hide();
							showDetails(this.desc);
							$('.ability-viewing').removeClass('ability-viewing');
							this.$abilityContainer.addClass('ability-viewing');
						}
					});
				} else {
					this.$abilityContainer.on({
						'mouseover': () => {
							$tableFooter.show();
							$orbFooter.hide();
							showDetails(this.desc);
						},
						'mouseout': () => {
							if (orbMenu) {
								$tableFooter.hide();
								$orbFooter.show();
							}
							showDetails();
						}
					});
				}
			}

			// returns a string of the ability's description
			makeDescription() {
				const cat = this.cat;
				const data = structuredClone(cat.data);
				const level = numericLevel(cat.getLevel());
				const values = data.abilities[this.ability];
				const abilityInfo = data_AbilityExplanations[this.ability];
				let text = [values.length > 0 ? formatString(abilityInfo.desc, values) : abilityInfo.desc];
				if (this.ability == 'multi-hit') {
					let hits = cat.calcDamage(true);
					for (let i = 0; i < hits.length; i++) {
						if (hits[i] == 0) {
							hits = hits.slice(0, i);
							break;
						}
						const args = [toDisplayString(hits[i])].concat(values.slice(i * 4 + 1, i * 4 + 4));
						hits[i] = formatString(this.info.desc, args);
					}
					text = [hits.join(' / ')];
					if ('mult-ranges' in data) {
						let ranges = [];
						for (const interval of data['mult-ranges']) {
							ranges.push(`${toDisplayString(interval[0])}~${toDisplayString(interval[1])}`);
						}
						text.push('Ranges: ' + ranges.join(' / '));
					}
					text.push(`Abilities: ${[values[3], values[7], values[11]].slice(0, hits.length).join(' / ')}`);
				} else if (durationAbilities.includes(this.ability)) {
					let comboMult = 1;
					if (capitalize(this.ability) in comboNums) comboMult = 1 + getComboTotal(capitalize(this.ability));
					if (cat.fruit == -1 && cat.fruitChangeType == 2) {
						const durationRange = [Math.floor(values[1] * comboMult), Math.floor(values[1] * comboMult * 1.2)];
						values[1] = `${durationRange[0]}~${durationRange[1]}`;
						values[2] = `${framesToSeconds(durationRange[0])}~${framesToSeconds(durationRange[1])}`;
						text = [values.length > 0 ? formatString(abilityInfo.desc, values) : abilityInfo.desc];
						const covLower = cat.calcUptime(data.abilities[this.ability][0] / 100, durationRange[0]);
						const covUpper = cat.calcUptime(data.abilities[this.ability][0] / 100, durationRange[1]);
						if (covLower == covUpper) {
							text.push(`Uptime: ${Math.round(covLower * 10000) / 100}%`);
						} else {
							text.push(`Uptime: ${Math.round(covLower * 10000) / 100}% ~ ${Math.round(covUpper * 10000) / 100}%`);
						}
					} else {
						let fruitBool = cat.fruit == 1;
						if (cat.fruit == -1) {
							fruitBool = cat.fruitChangeType == 0;
						}
						values[1] = Math.floor(values[1] * comboMult * (fruitBool ? 1.2 : 1));
						values[2] = framesToSeconds(values[1]);
						text = [values.length > 0 ? formatString(abilityInfo.desc, values) : abilityInfo.desc];
						const cov = cat.calcUptime(data.abilities[this.ability][0] / 100, values[1]);
						text.push(`Uptime: ${Math.round(cov * 10000) / 100}%`);
					}
				}
				return abilityDisplay(this.info.name, text.join('<br>'));
			}

			// updates the ability
			update() {
				this.desc = this.makeDescription();
				if (this.ability in this.cat.ultra && this.cat.talentMode >= 2) {
					this.$abilityContainer.addClass('ability-ultra');
				} else if (this.ability in this.cat.talents && this.cat.talentMode >= 1) {
					this.$abilityContainer.addClass('ability-talented');
				} else {
					this.$abilityContainer.removeClass('ability-talented').removeClass('ability-ultra');
				}
			}

			// appends its html container to the passed element
			appendTo($cell) {
				this.$abilityContainer.appendTo($cell);
			}

			// removes itself from the dom
			remove() {
				this.$abilityContainer.remove();
			}
		}

		// loading saved settings in query strings
		if (urlParams.has('combos')) {
			const comboStr = urlParams.get('combos');
			const comboEffectKeys = Object.keys(comboEffects);
			for (let i = 0; i < comboStr.length; i += 2) {
				const eff = comboEffectKeys[Number(`0x${comboStr.charAt(i)}`)];
				const mag = Number(comboStr.charAt(i + 1));
				const size = comboSizes[mag];
				const fullEffect = `${eff} (${size})`;
				$('<div>')
					.addClass(`cat-stats-tool__mini-combo${existingComboEffects.has(fullEffect) ? '' : ' nonexistent-combo'}`)
					.attr({
						'data-effect': comboEffects[eff],
						'data-size': mag
					})
					.text(fullEffect)
					.appendTo($comboList);
				combos[comboEffects[eff]].push(mag);
			}
		}
		if (urlParams.has('base')) {
			foundationLevel = Number(urlParams.get('base'));
			$foundationSlider.attr('value', foundationLevel);
			$foundationLevel.empty();
			const val = foundationLevel.toString();
			for (let i = 0; i < val.length; i++) {
				$foundationLevel.append(`<span class="level-image" data-value="${val.charAt(i)}"></span>`);
			}
		}
		if (urlParams.has('cats')) {
			const str = urlParams.get('cats');
			const chunks = str.split('|');
			for (let i = 0; i < chunks.length; i++) {
				const c = chunks[i];
				let value = Base64.toNumber(c).toString(2).padStart(compressionBits.reduce((partial, a) => partial + a, 0), '0');
				const values = [];
				for (let k = compressionBits.length - 1; k > 0; k--) {
					values.unshift(parseInt(value.slice(value.length - compressionBits[k]), 2));
					value = value.slice(0, value.length - compressionBits[k]);
				}
				values.unshift(parseInt(value, 2));
				const [id, form] = [values[0], values[1]];
				const abilityData = {};
				const list = Object.keys(toggleableAbilities);
				for (let k = 0; k < list.length; k++) {
					abilityData[list[k]] = !!values[4 + k];
				}
				const orbs = [
					values[14] == 7 ? false : { 'effect': orbEffects[values[14]], 'grade': orbGrades[values[15]] },
					values[16] == 7 ? false : { 'effect': orbEffects[values[16]], 'grade': orbGrades[values[17]] }
				];
				const orbData = {
					'attack': 0,
					'defense': 0,
					'strong': 0,
					'massive': 0,
					'resist': 0,
					'colossus': 0,
					'sol': 0
				};
				for (const o of orbs) {
					if (!o) continue;
					orbData[o.effect] += orbGrades.indexOf(o.grade) + 1;
				}
				const catInfo = {
					'level': values[2].toString(),
					'trait': values[3] == traitList.length ? '' : traitList[values[3]],
					'abilities': abilityData,
					'talent': values[13],
					'orbs': orbs,
					'orbData': orbData
				};
				for (let j = 0; j < data_CatData.length; j++) {
					const entry = data_CatData[j];
					if (entry.id == id && entry.form == form) {
						const newCat = new Cat(j, catInfo);
						catList.push(newCat);
						if (i < rowsPerPage) {
							newCat.add();
							$tableBody.append($spaceRow.clone());
						}
						break;
					}
				}
			}
			cleanSpaces();
			paginate();
		}
	}

	const query = {
		action: 'query',
		prop: 'revisions',
		titles: pages.join('|'),
		rvprop: 'content',
		rvslots: 'main',
		formatversion: '2',
		format: 'json',
		maxage: 600,
		smaxage: 600,
	};
	const data = await Promise.all([new mw.Api().get(query)]);
	const map = getDataQuery(data);
	init(map);
});
