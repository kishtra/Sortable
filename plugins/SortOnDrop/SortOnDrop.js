import { toggleClass, index, getRect } from '../../src/utils.js';

let validTarget, originalRect, isOverDropZone;
const initialPosition = { width: 0, height: 0 },
	initialScale = { width: 1, height: 1 };

function SortOnDropPlugin() {
	function SortOnDrop() {
		this.defaults = {
			sortIndicator: 'border', // border | nudge
			border: {
				width: '3px',
				style: 'solid',
				color: '#fff',
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
					setSortIndicator(validTarget, null, options, defaults);
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
					setSortIndicator(validTarget, null, options, defaults);
					toggleClass(validTarget, options.dropZoneClass, false);
				}
				validTarget = target;
				originalRect = getRect(validTarget);
			}

			if (isOverDropZone) dispatchSortableEvent('dropZoneHover');

			setSortIndicator(
				validTarget,
				getSideFactors(this, originalEvent),
				options,
				defaults
			);
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

			setSortIndicator(validTarget, null, options, defaults);
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
			validTarget = originalRect = isOverDropZone = null;
		},
	};

	return Object.assign(SortOnDrop, {
		pluginName: 'sortOnDrop',
	});
}

function getSideFactors(plugin, originalEvent) {
	let sideFactors = {},
		dimensions = [],
		options = plugin.options,
		frame = {
			width: (originalRect.width * (1 - options.dropZone)) / 2, // left | right
			height: (originalRect.height * (1 - options.dropZone)) / 2, // top | bottom
		},
		targetOffset = {
			width: originalEvent.offsetX,
			height: originalEvent.offsetY,
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

	isOverDropZone = true;

	for (const dimension of dimensions) {
		if (
			(targetOffset[dimension] <= frame[dimension] && (sideFactors[dimension] = 1)) ||
			(targetOffset[dimension] >= originalRect[dimension] - frame[dimension] &&
				(sideFactors[dimension] = -1))
		)
			isOverDropZone = false;
	}
	return sideFactors;
}

function setSortIndicator(target, sideFactors, options, defaults) {
	switch (options.sortIndicator) {
		case 'border':
			setBorder(target, sideFactors, options);
			break;
		case 'nudge':
			setNudge(target, sideFactors, options, defaults);
			break;
		default:
			throw new Error('Invalid sortIndicator');
	}
}

function setBorder(target, sideFactors, options) {
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
		for (const prop in options.border)
			target.style[side + capitalizeFirstChar(prop)] = borderSides[side]
				? options.border[prop]
				: '';
	}
}

function setNudge(target, sideFactors, options, defaults) {
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

	target.style.transition = `transform  ${options.nudge.nudgeAnimation}ms ease`;
	target.style.transform = `translate(${translate.width}px, ${translate.height}px) scale(${scale.width}, ${scale.height})`;
}

function sortNodes(n1, n2) {
	let p1 = n1.parentNode,
		p2 = n2.parentNode,
		i1,
		i2;

	if (!p1 || !p2 || p1.isEqualNode(n2) || p2.isEqualNode(n1)) return;

	i1 = index(n1);
	i2 = index(n2);

	if (p1.isEqualNode(p2) && i1 < i2) {
		i2++;
	}

	p2.insertBefore(n1, p2.children[i2]);
}

export default SortOnDropPlugin;
