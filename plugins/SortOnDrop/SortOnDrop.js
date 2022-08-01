import { toggleClass, index, getRect } from '../../src/utils.js';

let validTarget, originalRect, isOverDropZone, lastSideFactors;
const initialPosition = { width: 0, height: 0 },
	initialScale = { width: 1, height: 1 };

function SortOnDropPlugin() {
	function SortOnDrop() {
		this.defaults = {
			sortIndicator: 'border', // border | nudge
			border: {
				width: '3px',
				style: 'solid',
				color: '#000',
			},
			nudge: {
				scaleFactor: 0.8,
				nudgeAnimation: 250,
			},
			dropZone: 0,
			dropZoneClass: 'drop-zone-class',
		};
	}

	SortOnDrop.prototype = {
		dragOver({ activeSortable, target, dragEl, completed, cancel }) {
			const options = this.options,
				defaults = this.defaults;

			if (!activeSortable?.options.sortOnDrop || target.isEqualNode(dragEl)) {
				if (validTarget) {
					setSortIndicator(options, defaults, null);
					toggleClass(validTarget, options.dropZoneClass, false);
					validTarget = null;
				}

				completed(false);
				cancel();
			}
		},
		dragOverValid({
			target,
			dragEl,
			originalEvent,
			onMove,
			dispatchSortableEvent,
			changed,
			completed,
			cancel,
		}) {
			const el = this.sortable.el,
				options = this.options,
				defaults = this.defaults;

			if (target === el || target.contains(dragEl) || onMove(target) === false)
				return cancel();

			if (target !== validTarget) {
				if (validTarget) {
					setSortIndicator(options, defaults, null);
					toggleClass(validTarget, options.dropZoneClass, false);
				}
				validTarget = target;
				originalRect = getRect(validTarget);
			}

			if (isOverDropZone) dispatchSortableEvent('dropZoneHover');

			setSideFactors(this, originalEvent);
			setSortIndicator(options, defaults);
			toggleClass(validTarget, options.dropZoneClass, isOverDropZone);

			changed();
			completed(true);
			cancel();
		},
		drop({ activeSortable, putSortable, dragEl, dispatchSortableEvent }) {
			const toSortable = putSortable || this.sortable,
				options = this.options,
				defaults = this.defaults;

			if (!validTarget) return;

			setSortIndicator(options, defaults, null);
			toggleClass(validTarget, options.dropZoneClass, false);

			if (isOverDropZone) return dispatchSortableEvent('dropZoneDrop');

			if (options.sortOnDrop || (putSortable && putSortable.options.sortOnDrop)) {
				toSortable.captureAnimationState();
				if (toSortable !== activeSortable) activeSortable.captureAnimationState();

				sortNodes(dragEl, validTarget);

				toSortable.animateAll();
				if (toSortable !== activeSortable) activeSortable.animateAll();
			}
		},
		nulling() {
			validTarget = originalRect = isOverDropZone = lastSideFactors = null;
		},
	};

	return Object.assign(SortOnDrop, {
		pluginName: 'sortOnDrop',
	});
}

function setSideFactors(plugin, originalEvent) {
	let dimensions = [],
		options = plugin.options,
		borderWidth = +getComputedStyle(validTarget, null).borderWidth.slice(0, -2),
		frame = {
			width: (originalRect.width * (1 - options.dropZone)) / 2, // left | right
			height: (originalRect.height * (1 - options.dropZone)) / 2, // top | bottom
		},
		targetOffset = {
			width: originalEvent.offsetX + borderWidth,
			height: originalEvent.offsetY + borderWidth,
		};

	switch (
		typeof options.direction === 'function'
			? options.direction.call(plugin)
			: options.direction
	) {
		case 'horizontal':
			dimensions.push('width');
			break;
		case 'vertical':
			dimensions.push('height');
			break;
		case '2d':
			dimensions.push('width', 'height');
			break;
		default:
			throw new Error('Invalid direction');
	}

	lastSideFactors = {};
	for (const dimension of dimensions) {
		isOverDropZone =
			(targetOffset[dimension] <= frame[dimension] &&
				(lastSideFactors[dimension] = 1)) ||
			(targetOffset[dimension] >= originalRect[dimension] - frame[dimension] &&
				(lastSideFactors[dimension] = -1))
				? false
				: true;
	}
}

function setSortIndicator(options, defaults, sideFactors = lastSideFactors) {
	if (!sideFactors) {
		setBorder(options, null);
		setNudge(options, defaults, null);
	}

	switch (options.sortIndicator) {
		case 'border':
			setBorder(options, sideFactors);
			break;
		case 'nudge':
			setNudge(options, defaults, sideFactors);
			break;
		default:
			throw new Error('Invalid sortIndicator');
	}
}

function setBorder(options, sideFactors) {
	const borderSides = {
		borderTop: false,
		borderBottom: false,
		borderLeft: false,
		borderRight: false,
	};

	for (const dimension in sideFactors) {
		switch (dimension) {
			case 'width':
				borderSides[
					sideFactors[dimension] > 0 ? 'borderLeft' : 'borderRight'
				] = true;
				break;
			case 'height':
				borderSides[
					sideFactors[dimension] > 0 ? 'borderTop' : 'borderBottom'
				] = true;
				break;
		}
	}

	const capitalizeFirstChar = (str) => str[0].toUpperCase() + str.slice(1);

	for (const side in borderSides) {
		for (const prop in options.border) {
			validTarget.style[side + capitalizeFirstChar(prop)] = borderSides[side]
				? options.border[prop]
				: '';
		}
	}
}

function setNudge(options, defaults, sideFactors) {
	let translate = Object.assign({}, initialPosition),
		scale = Object.assign({}, initialScale);

	// Set default nudge props
	for (let prop in defaults.nudge)
		!(prop in options.nudge) && (options.nudge[prop] = defaults.nudge[prop]);

	for (const dimension in sideFactors) {
		scale[dimension] = options.nudge.scaleFactor;
		translate[dimension] =
			(originalRect[dimension] * (1 - scale[dimension]) * sideFactors[dimension]) / 2;
	}

	validTarget.style.transition = `transform  ${options.nudge.nudgeAnimation}ms ease`;
	validTarget.style.transform = `translate(${translate.width}px, ${translate.height}px) scale(${scale.width}, ${scale.height})`;
}

function sortNodes(dragEl, target) {
	let dragElParent = dragEl.parentNode,
		targetParent = target.parentNode,
		dragElIndex,
		targetIndex;

	if (
		!dragElParent ||
		!targetParent ||
		dragElParent.isEqualNode(target) ||
		targetParent.isEqualNode(dragEl)
	)
		return;

	dragElIndex = index(dragEl);
	targetIndex = index(target);

	if (
		(dragElParent.isEqualNode(targetParent) &&
			dragElIndex < targetIndex &&
			(lastSideFactors.height < 0 || lastSideFactors.width < 0)) ||
		lastSideFactors.height < 0 ||
		lastSideFactors.width < 0
	) {
		targetIndex++;
	}

	targetParent.insertBefore(dragEl, targetParent.children[targetIndex]);
}

export default SortOnDropPlugin;
