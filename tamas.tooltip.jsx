// jQuery tooltip for React app by Tamas Kuzmics

import $ from 'jquery';
import '../css/tooltip.css';
import { renderToString } from 'react-dom/server';
import { useState, useEffect, useRef, isValidElement } from 'react';

export default ({appContext}) => {

    let $_tooltipTimer = null;
    let $_tooltipScrollTimer = null;
    const tooltipItems = useRef([]);
    const [tooltipContent, setTooltipContent] = useState('');

    const addTooltipItem = ($element, content, callback, delay) => {
        if (isValidElement(content)) { // run js code before use in tooltip..
          //  $element.attr('tooltip-content', renderToString(content));
        } else {
            content = <div dangerouslySetInnerHTML={{__html: content}} />;
        }
        let items = tooltipItems.current.filter(v => v.element.is($element) == false);
        items.push({ element: $element, content: content, callback: callback, delay: delay });
        tooltipItems.current = items;
    };

    const addTooltipMouseClick = ($element) => {
        $element
        .off('click.tooltip')
        .on('click.tooltip', function(e) {
            e.stopPropagation();
            $(this).toggleClass('keep-open');
        });
    };

    const addTooltipMouseEnter = ($element) => {
        $element
        .off('mouseenter.tooltip')
        .on('mouseenter.tooltip', function(e) {
            e.stopPropagation();
            let opened = $('.keep-open');
            if (opened.length > 0 && !opened.is(this)) {
                opened.removeClass('keep-open');
                $.hideTooltip();
            }
            $(this).showTooltip();
        });
    };

    const addTooltipMouseLeave = ($element) => {
        $element
        .off('mouseleave.tooltip')
        .on('mouseleave.tooltip', function(e) {
            e.stopPropagation();
            let opened = $(this).hasClass('keep-open');
            if (opened == false) {
                $.hideTooltip();
            }
        });
    };

    // ####################################################################
    // hide after init -> react state or props changes..
    // bind all [tooltip-content] in document..
    // ####################################################################

    useEffect(() => $.hideTooltip(), [appContext]);

    useEffect(() => {
        $(document)
        .off('click.tooltip-close')
        .on('click.tooltip-close', function(e) {
            if ($(e.target).closest('#global-tooltip').length == 0) {
                e.stopPropagation();
                let opened = $('.keep-open');
                if (opened.length > 0) {
                    opened.removeClass('keep-open');
                    $.hideTooltip();
                }
            }
        });
    }, []);

    // ####################################################################
    // addTooltip
    // ####################################################################

    $.fn.addTooltip = function(content = null, callback = null, delay = 250)
    {
        let $element = $(this);
        let $tooltip = $('#global-tooltip');

        if ($tooltip.length == 0) {
            return console.error('#global-tooltip is undefined.');
        }
        if ($element.length == 0 || typeof $element !== 'object') {
            return console.error('support only jQuery objects.');
        }

        // save attributes and events..
        addTooltipItem($element, content, callback, delay);
        addTooltipMouseClick($element);
        addTooltipMouseEnter($element);
        addTooltipMouseLeave($element);

        return $element;
    };

    // ####################################################################
    // showTooltip
    // ####################################################################

    $.fn.showTooltip = function(content = null, callback = null, delay = 250)
    {
        let $element = $(this);
        let $tooltip = $('#global-tooltip');

        if ($tooltip.length == 0) {
            return console.error('#global-tooltip is undefined.');
        }
        if ($element.length == 0 || typeof $element !== 'object') {
            return console.error('support only jQuery objects.');
        }

        // clear timers for safety..

        clearTimeout($_tooltipTimer);
        clearTimeout($_tooltipScrollTimer);

        // get or add new react tooltip item..

        let tooltipItem = tooltipItems.current.find(v => v.element.is($element));
        if (tooltipItem == undefined && content == null) {
            return console.error('React tooltip component is undefined.');
        } else if (content) { // called showTooltip directly..
            tooltipItem = // update tooltipItem..
            addTooltipItem($element, content, callback, delay);
            addTooltipMouseLeave($element);
        } else {
            delay = tooltipItem.delay;
            content = tooltipItem.content;
            callback = tooltipItem.callback;
        }

        if (callback != null) // convert to function..
        {
            eval(`callback = ${callback}`); // overwrite callback variable
        }

        // change cursor for safety..

        $element.css({'cursor':'pointer'});

        // start timer..

        $_tooltipTimer = setTimeout(function() {
            // item + page
            let top = $element.offset().top;
            let left = $element.offset().left;
            let width = $element.outerWidth();
            let height = $element.outerHeight();
            let maxWidth = $(document).width();
            let maxHeight = $(document).height();
            let scrollTop = $(window).scrollTop();
            // svg resize bugfix
            let parentSVG = $element.parents('svg');
            if (parentSVG.length > 0) {
                let viewBox = parentSVG.attr('viewBox').split(' ');
                let origWidth = viewBox[2];
                let origHeight = viewBox[3];
                if (origWidth != parentSVG.width()
                || origHeight != parentSVG.height()) {
                    let multiply = // use bigger change..
                    Math.min(parentSVG.width() / origWidth,
                             parentSVG.height() / origHeight);
                    width *= multiply;
                    height *= multiply;
                }
            }
            setTooltipContent(content);
            $tooltip.css({'top': 0, 'left': 0}); // offset!
            let tooltipWidth = $tooltip.outerWidth();
            let tooltipHeight = $tooltip.outerHeight();
            let leftPosition = left + (width / 2) - (tooltipWidth / 2);
            let rightPosition = leftPosition + tooltipWidth;
            let arrowLeftDiff = 0;

            // vertical direction with clamp..
            if (top - scrollTop - tooltipHeight >= 0) {
                $tooltip.removeClass().addClass('top');
                top = Math.max(0, top - tooltipHeight);
            } else {
                $tooltip.removeClass().addClass('bottom');
                top = Math.min(maxHeight, top + height);
            }
            // horizontal direction with clamp..
            if (rightPosition > maxWidth) {
                let overflow = arrowLeftDiff = rightPosition - maxWidth;
                left = Math.max(0, leftPosition - overflow);
            } else {
                left = Math.max(0, leftPosition);
                arrowLeftDiff = Math.min(0, leftPosition);
            }
            $tooltip.css({'top': top, 'left': left, 'display': 'block'}).addClass('show');
            $tooltip.find('.tooltip-arrow').css({'margin-left': arrowLeftDiff});
            // apply callback
            if (typeof callback === 'function') {
                callback();
            }
            // hide during scroll + update position..
            $(window).off('scroll.tooltip').on('scroll.tooltip', function(e) {
                $tooltip.hide();
                clearTimeout($_tooltipScrollTimer);
                $_tooltipScrollTimer = setTimeout(function() {
                    $element.showTooltip(content, callback, delay); // TODO: check overflow..
                }, 500);
            });
        }, delay);
    };

    // ####################################################################
    // hide function
    // ####################################################################

    $.hideTooltip = function() {
        let $tooltip = $('#global-tooltip');
        if ($tooltip.length == 0) {
            return $.error('#global-tooltip is undefined.');
        }
        $tooltip
        .attr('style', '')
        .removeClass('show');
        setTooltipContent('');
        clearTimeout($_tooltipScrollTimer);
        $(window).off('scroll.tooltip');
        clearTimeout($_tooltipTimer);
    };

    return (
        <div id="global-tooltip" className="top">
            <div className="tooltip-content">{tooltipContent}</div>
            <div className="tooltip-arrow">
                <svg className="aui-popover__arrow-shape" width="20" height="20" viewBox="0 0 20 20">
                    <path d="M10 0 L 20 10 L 10 20 L 0 10 Z" fill="#404040"></path>
                </svg>
            </div>
        </div>
    );
};
