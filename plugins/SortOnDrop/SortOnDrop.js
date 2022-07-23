import { toggleClass, index, getRect } from '../../src/utils.js';

let validTarget, originalRect, isOverDropZone;
const defaultPosition = { width: 0, height: 0 },
	defaultScale = { width: 1, height: 1 };

function SortOnDropPlugin() {
	function SortOnDrop() {
		this.defaults = {
			sortIndicator: 'border', // border | nudge
			border: {
				color: '#fff',
				width: '1px',
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
			let options = this.options;

			if (!activeSortable?.options.sortOnDrop || target.isEqualNode(dragEl)) {
				if (validTarget) {
					setSortIndicator(validTarget, options, null);
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
				options = this.options;

			if (target === el || target.contains(dragEl) || onMove(target) === false)
				return cancel();

			if (target !== validTarget) {
				if (validTarget) {
					setSortIndicator(validTarget, options, null);
					toggleClass(validTarget, options.dropZoneClass, false);
				}
				validTarget = target;
				originalRect = getRect(validTarget);

				// TODO: store previous transition if existed
				validTarget.style.transition = `all ${options.nudge.nudgeAnimation}ms ease`;
			}

			if (isOverDropZone) dispatchSortableEvent('dropZoneHover');
			toggleClass(validTarget, options.dropZoneClass, isOverDropZone);
			setSortIndicator(validTarget, options, getSideFactors.call(this, originalEvent));

			changed();
			completed(true);
			cancel();
		},
		drop({ activeSortable, putSortable, dragEl, dispatchSortableEvent }) {
			let toSortable = putSortable || this.sortable,
				options = this.options;

			if (!validTarget) return;

			toggleClass(validTarget, options.dropZoneClass, false);
			setSortIndicator(validTarget, options, null);

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

function getSideFactors(originalEvent) {
	let sideFactors = {},
		dimensions = [],
		options = this.options,
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
			? options.direction.call(this)
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

function setSortIndicator(target, options, sideFactors) {
	let indicateSort;

	switch (options.sortIndicator) {
		case 'border':
			indicateSort = setBorder;
			break;
		case 'nudge':
			indicateSort = setNudge;
			break;
		default:
			throw new Error('Invalid sortIndicator');
	}

	indicateSort(target, options, sideFactors);
}

function setBorder(target) {
	console.log(target.style);
	target.style.borderBottomColor = '#659e33';
}

function setNudge(target, options, sideFactors) {
	let translate = Object.assign({}, defaultPosition),
		scale = Object.assign({}, defaultScale);

	for (const dimension in sideFactors) {
		scale[dimension] = options.nudge.scaleFactor;
		translate[dimension] =
			(originalRect[dimension] * (1 - scale[dimension]) * sideFactors[dimension]) / 2;
	}

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
