(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.lasso = {}));
}(this, (function (exports) { 'use strict';

  var xhtml = "http://www.w3.org/1999/xhtml";

  var namespaces = {
    svg: "http://www.w3.org/2000/svg",
    xhtml: xhtml,
    xlink: "http://www.w3.org/1999/xlink",
    xml: "http://www.w3.org/XML/1998/namespace",
    xmlns: "http://www.w3.org/2000/xmlns/"
  };

  function namespace(name) {
    var prefix = name += "", i = prefix.indexOf(":");
    if (i >= 0 && (prefix = name.slice(0, i)) !== "xmlns") name = name.slice(i + 1);
    return namespaces.hasOwnProperty(prefix) ? {space: namespaces[prefix], local: name} : name;
  }

  function creatorInherit(name) {
    return function() {
      var document = this.ownerDocument,
          uri = this.namespaceURI;
      return uri === xhtml && document.documentElement.namespaceURI === xhtml
          ? document.createElement(name)
          : document.createElementNS(uri, name);
    };
  }

  function creatorFixed(fullname) {
    return function() {
      return this.ownerDocument.createElementNS(fullname.space, fullname.local);
    };
  }

  function creator(name) {
    var fullname = namespace(name);
    return (fullname.local
        ? creatorFixed
        : creatorInherit)(fullname);
  }

  function none() {}

  function selector(selector) {
    return selector == null ? none : function() {
      return this.querySelector(selector);
    };
  }

  function selection_select(select) {
    if (typeof select !== "function") select = selector(select);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = new Array(n), node, subnode, i = 0; i < n; ++i) {
        if ((node = group[i]) && (subnode = select.call(node, node.__data__, i, group))) {
          if ("__data__" in node) subnode.__data__ = node.__data__;
          subgroup[i] = subnode;
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function empty() {
    return [];
  }

  function selectorAll(selector) {
    return selector == null ? empty : function() {
      return this.querySelectorAll(selector);
    };
  }

  function selection_selectAll(select) {
    if (typeof select !== "function") select = selectorAll(select);

    for (var groups = this._groups, m = groups.length, subgroups = [], parents = [], j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          subgroups.push(select.call(node, node.__data__, i, group));
          parents.push(node);
        }
      }
    }

    return new Selection(subgroups, parents);
  }

  function matcher(selector) {
    return function() {
      return this.matches(selector);
    };
  }

  function selection_filter(match) {
    if (typeof match !== "function") match = matcher(match);

    for (var groups = this._groups, m = groups.length, subgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, subgroup = subgroups[j] = [], node, i = 0; i < n; ++i) {
        if ((node = group[i]) && match.call(node, node.__data__, i, group)) {
          subgroup.push(node);
        }
      }
    }

    return new Selection(subgroups, this._parents);
  }

  function sparse(update) {
    return new Array(update.length);
  }

  function selection_enter() {
    return new Selection(this._enter || this._groups.map(sparse), this._parents);
  }

  function EnterNode(parent, datum) {
    this.ownerDocument = parent.ownerDocument;
    this.namespaceURI = parent.namespaceURI;
    this._next = null;
    this._parent = parent;
    this.__data__ = datum;
  }

  EnterNode.prototype = {
    constructor: EnterNode,
    appendChild: function(child) { return this._parent.insertBefore(child, this._next); },
    insertBefore: function(child, next) { return this._parent.insertBefore(child, next); },
    querySelector: function(selector) { return this._parent.querySelector(selector); },
    querySelectorAll: function(selector) { return this._parent.querySelectorAll(selector); }
  };

  function constant$1(x) {
    return function() {
      return x;
    };
  }

  var keyPrefix = "$"; // Protect against keys like “__proto__”.

  function bindIndex(parent, group, enter, update, exit, data) {
    var i = 0,
        node,
        groupLength = group.length,
        dataLength = data.length;

    // Put any non-null nodes that fit into update.
    // Put any null nodes into enter.
    // Put any remaining data into enter.
    for (; i < dataLength; ++i) {
      if (node = group[i]) {
        node.__data__ = data[i];
        update[i] = node;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Put any non-null nodes that don’t fit into exit.
    for (; i < groupLength; ++i) {
      if (node = group[i]) {
        exit[i] = node;
      }
    }
  }

  function bindKey(parent, group, enter, update, exit, data, key) {
    var i,
        node,
        nodeByKeyValue = {},
        groupLength = group.length,
        dataLength = data.length,
        keyValues = new Array(groupLength),
        keyValue;

    // Compute the key for each node.
    // If multiple nodes have the same key, the duplicates are added to exit.
    for (i = 0; i < groupLength; ++i) {
      if (node = group[i]) {
        keyValues[i] = keyValue = keyPrefix + key.call(node, node.__data__, i, group);
        if (keyValue in nodeByKeyValue) {
          exit[i] = node;
        } else {
          nodeByKeyValue[keyValue] = node;
        }
      }
    }

    // Compute the key for each datum.
    // If there a node associated with this key, join and add it to update.
    // If there is not (or the key is a duplicate), add it to enter.
    for (i = 0; i < dataLength; ++i) {
      keyValue = keyPrefix + key.call(parent, data[i], i, data);
      if (node = nodeByKeyValue[keyValue]) {
        update[i] = node;
        node.__data__ = data[i];
        nodeByKeyValue[keyValue] = null;
      } else {
        enter[i] = new EnterNode(parent, data[i]);
      }
    }

    // Add any remaining nodes that were not bound to data to exit.
    for (i = 0; i < groupLength; ++i) {
      if ((node = group[i]) && (nodeByKeyValue[keyValues[i]] === node)) {
        exit[i] = node;
      }
    }
  }

  function selection_data(value, key) {
    if (!value) {
      data = new Array(this.size()), j = -1;
      this.each(function(d) { data[++j] = d; });
      return data;
    }

    var bind = key ? bindKey : bindIndex,
        parents = this._parents,
        groups = this._groups;

    if (typeof value !== "function") value = constant$1(value);

    for (var m = groups.length, update = new Array(m), enter = new Array(m), exit = new Array(m), j = 0; j < m; ++j) {
      var parent = parents[j],
          group = groups[j],
          groupLength = group.length,
          data = value.call(parent, parent && parent.__data__, j, parents),
          dataLength = data.length,
          enterGroup = enter[j] = new Array(dataLength),
          updateGroup = update[j] = new Array(dataLength),
          exitGroup = exit[j] = new Array(groupLength);

      bind(parent, group, enterGroup, updateGroup, exitGroup, data, key);

      // Now connect the enter nodes to their following update node, such that
      // appendChild can insert the materialized enter node before this node,
      // rather than at the end of the parent node.
      for (var i0 = 0, i1 = 0, previous, next; i0 < dataLength; ++i0) {
        if (previous = enterGroup[i0]) {
          if (i0 >= i1) i1 = i0 + 1;
          while (!(next = updateGroup[i1]) && ++i1 < dataLength);
          previous._next = next || null;
        }
      }
    }

    update = new Selection(update, parents);
    update._enter = enter;
    update._exit = exit;
    return update;
  }

  function selection_exit() {
    return new Selection(this._exit || this._groups.map(sparse), this._parents);
  }

  function selection_join(onenter, onupdate, onexit) {
    var enter = this.enter(), update = this, exit = this.exit();
    enter = typeof onenter === "function" ? onenter(enter) : enter.append(onenter + "");
    if (onupdate != null) update = onupdate(update);
    if (onexit == null) exit.remove(); else onexit(exit);
    return enter && update ? enter.merge(update).order() : update;
  }

  function selection_merge(selection) {

    for (var groups0 = this._groups, groups1 = selection._groups, m0 = groups0.length, m1 = groups1.length, m = Math.min(m0, m1), merges = new Array(m0), j = 0; j < m; ++j) {
      for (var group0 = groups0[j], group1 = groups1[j], n = group0.length, merge = merges[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group0[i] || group1[i]) {
          merge[i] = node;
        }
      }
    }

    for (; j < m0; ++j) {
      merges[j] = groups0[j];
    }

    return new Selection(merges, this._parents);
  }

  function selection_order() {

    for (var groups = this._groups, j = -1, m = groups.length; ++j < m;) {
      for (var group = groups[j], i = group.length - 1, next = group[i], node; --i >= 0;) {
        if (node = group[i]) {
          if (next && node.compareDocumentPosition(next) ^ 4) next.parentNode.insertBefore(node, next);
          next = node;
        }
      }
    }

    return this;
  }

  function selection_sort(compare) {
    if (!compare) compare = ascending;

    function compareNode(a, b) {
      return a && b ? compare(a.__data__, b.__data__) : !a - !b;
    }

    for (var groups = this._groups, m = groups.length, sortgroups = new Array(m), j = 0; j < m; ++j) {
      for (var group = groups[j], n = group.length, sortgroup = sortgroups[j] = new Array(n), node, i = 0; i < n; ++i) {
        if (node = group[i]) {
          sortgroup[i] = node;
        }
      }
      sortgroup.sort(compareNode);
    }

    return new Selection(sortgroups, this._parents).order();
  }

  function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function selection_call() {
    var callback = arguments[0];
    arguments[0] = this;
    callback.apply(null, arguments);
    return this;
  }

  function selection_nodes() {
    var nodes = new Array(this.size()), i = -1;
    this.each(function() { nodes[++i] = this; });
    return nodes;
  }

  function selection_node() {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length; i < n; ++i) {
        var node = group[i];
        if (node) return node;
      }
    }

    return null;
  }

  function selection_size() {
    var size = 0;
    this.each(function() { ++size; });
    return size;
  }

  function selection_empty() {
    return !this.node();
  }

  function selection_each(callback) {

    for (var groups = this._groups, j = 0, m = groups.length; j < m; ++j) {
      for (var group = groups[j], i = 0, n = group.length, node; i < n; ++i) {
        if (node = group[i]) callback.call(node, node.__data__, i, group);
      }
    }

    return this;
  }

  function attrRemove(name) {
    return function() {
      this.removeAttribute(name);
    };
  }

  function attrRemoveNS(fullname) {
    return function() {
      this.removeAttributeNS(fullname.space, fullname.local);
    };
  }

  function attrConstant(name, value) {
    return function() {
      this.setAttribute(name, value);
    };
  }

  function attrConstantNS(fullname, value) {
    return function() {
      this.setAttributeNS(fullname.space, fullname.local, value);
    };
  }

  function attrFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttribute(name);
      else this.setAttribute(name, v);
    };
  }

  function attrFunctionNS(fullname, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.removeAttributeNS(fullname.space, fullname.local);
      else this.setAttributeNS(fullname.space, fullname.local, v);
    };
  }

  function selection_attr(name, value) {
    var fullname = namespace(name);

    if (arguments.length < 2) {
      var node = this.node();
      return fullname.local
          ? node.getAttributeNS(fullname.space, fullname.local)
          : node.getAttribute(fullname);
    }

    return this.each((value == null
        ? (fullname.local ? attrRemoveNS : attrRemove) : (typeof value === "function"
        ? (fullname.local ? attrFunctionNS : attrFunction)
        : (fullname.local ? attrConstantNS : attrConstant)))(fullname, value));
  }

  function defaultView(node) {
    return (node.ownerDocument && node.ownerDocument.defaultView) // node is a Node
        || (node.document && node) // node is a Window
        || node.defaultView; // node is a Document
  }

  function styleRemove(name) {
    return function() {
      this.style.removeProperty(name);
    };
  }

  function styleConstant(name, value, priority) {
    return function() {
      this.style.setProperty(name, value, priority);
    };
  }

  function styleFunction(name, value, priority) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) this.style.removeProperty(name);
      else this.style.setProperty(name, v, priority);
    };
  }

  function selection_style(name, value, priority) {
    return arguments.length > 1
        ? this.each((value == null
              ? styleRemove : typeof value === "function"
              ? styleFunction
              : styleConstant)(name, value, priority == null ? "" : priority))
        : styleValue(this.node(), name);
  }

  function styleValue(node, name) {
    return node.style.getPropertyValue(name)
        || defaultView(node).getComputedStyle(node, null).getPropertyValue(name);
  }

  function propertyRemove(name) {
    return function() {
      delete this[name];
    };
  }

  function propertyConstant(name, value) {
    return function() {
      this[name] = value;
    };
  }

  function propertyFunction(name, value) {
    return function() {
      var v = value.apply(this, arguments);
      if (v == null) delete this[name];
      else this[name] = v;
    };
  }

  function selection_property(name, value) {
    return arguments.length > 1
        ? this.each((value == null
            ? propertyRemove : typeof value === "function"
            ? propertyFunction
            : propertyConstant)(name, value))
        : this.node()[name];
  }

  function classArray(string) {
    return string.trim().split(/^|\s+/);
  }

  function classList(node) {
    return node.classList || new ClassList(node);
  }

  function ClassList(node) {
    this._node = node;
    this._names = classArray(node.getAttribute("class") || "");
  }

  ClassList.prototype = {
    add: function(name) {
      var i = this._names.indexOf(name);
      if (i < 0) {
        this._names.push(name);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    remove: function(name) {
      var i = this._names.indexOf(name);
      if (i >= 0) {
        this._names.splice(i, 1);
        this._node.setAttribute("class", this._names.join(" "));
      }
    },
    contains: function(name) {
      return this._names.indexOf(name) >= 0;
    }
  };

  function classedAdd(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.add(names[i]);
  }

  function classedRemove(node, names) {
    var list = classList(node), i = -1, n = names.length;
    while (++i < n) list.remove(names[i]);
  }

  function classedTrue(names) {
    return function() {
      classedAdd(this, names);
    };
  }

  function classedFalse(names) {
    return function() {
      classedRemove(this, names);
    };
  }

  function classedFunction(names, value) {
    return function() {
      (value.apply(this, arguments) ? classedAdd : classedRemove)(this, names);
    };
  }

  function selection_classed(name, value) {
    var names = classArray(name + "");

    if (arguments.length < 2) {
      var list = classList(this.node()), i = -1, n = names.length;
      while (++i < n) if (!list.contains(names[i])) return false;
      return true;
    }

    return this.each((typeof value === "function"
        ? classedFunction : value
        ? classedTrue
        : classedFalse)(names, value));
  }

  function textRemove() {
    this.textContent = "";
  }

  function textConstant(value) {
    return function() {
      this.textContent = value;
    };
  }

  function textFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.textContent = v == null ? "" : v;
    };
  }

  function selection_text(value) {
    return arguments.length
        ? this.each(value == null
            ? textRemove : (typeof value === "function"
            ? textFunction
            : textConstant)(value))
        : this.node().textContent;
  }

  function htmlRemove() {
    this.innerHTML = "";
  }

  function htmlConstant(value) {
    return function() {
      this.innerHTML = value;
    };
  }

  function htmlFunction(value) {
    return function() {
      var v = value.apply(this, arguments);
      this.innerHTML = v == null ? "" : v;
    };
  }

  function selection_html(value) {
    return arguments.length
        ? this.each(value == null
            ? htmlRemove : (typeof value === "function"
            ? htmlFunction
            : htmlConstant)(value))
        : this.node().innerHTML;
  }

  function raise() {
    if (this.nextSibling) this.parentNode.appendChild(this);
  }

  function selection_raise() {
    return this.each(raise);
  }

  function lower() {
    if (this.previousSibling) this.parentNode.insertBefore(this, this.parentNode.firstChild);
  }

  function selection_lower() {
    return this.each(lower);
  }

  function selection_append(name) {
    var create = typeof name === "function" ? name : creator(name);
    return this.select(function() {
      return this.appendChild(create.apply(this, arguments));
    });
  }

  function constantNull() {
    return null;
  }

  function selection_insert(name, before) {
    var create = typeof name === "function" ? name : creator(name),
        select = before == null ? constantNull : typeof before === "function" ? before : selector(before);
    return this.select(function() {
      return this.insertBefore(create.apply(this, arguments), select.apply(this, arguments) || null);
    });
  }

  function remove() {
    var parent = this.parentNode;
    if (parent) parent.removeChild(this);
  }

  function selection_remove() {
    return this.each(remove);
  }

  function selection_cloneShallow() {
    var clone = this.cloneNode(false), parent = this.parentNode;
    return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
  }

  function selection_cloneDeep() {
    var clone = this.cloneNode(true), parent = this.parentNode;
    return parent ? parent.insertBefore(clone, this.nextSibling) : clone;
  }

  function selection_clone(deep) {
    return this.select(deep ? selection_cloneDeep : selection_cloneShallow);
  }

  function selection_datum(value) {
    return arguments.length
        ? this.property("__data__", value)
        : this.node().__data__;
  }

  var filterEvents = {};

  var event = null;

  if (typeof document !== "undefined") {
    var element = document.documentElement;
    if (!("onmouseenter" in element)) {
      filterEvents = {mouseenter: "mouseover", mouseleave: "mouseout"};
    }
  }

  function filterContextListener(listener, index, group) {
    listener = contextListener(listener, index, group);
    return function(event) {
      var related = event.relatedTarget;
      if (!related || (related !== this && !(related.compareDocumentPosition(this) & 8))) {
        listener.call(this, event);
      }
    };
  }

  function contextListener(listener, index, group) {
    return function(event1) {
      var event0 = event; // Events can be reentrant (e.g., focus).
      event = event1;
      try {
        listener.call(this, this.__data__, index, group);
      } finally {
        event = event0;
      }
    };
  }

  function parseTypenames$1(typenames) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      return {type: t, name: name};
    });
  }

  function onRemove(typename) {
    return function() {
      var on = this.__on;
      if (!on) return;
      for (var j = 0, i = -1, m = on.length, o; j < m; ++j) {
        if (o = on[j], (!typename.type || o.type === typename.type) && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
        } else {
          on[++i] = o;
        }
      }
      if (++i) on.length = i;
      else delete this.__on;
    };
  }

  function onAdd(typename, value, capture) {
    var wrap = filterEvents.hasOwnProperty(typename.type) ? filterContextListener : contextListener;
    return function(d, i, group) {
      var on = this.__on, o, listener = wrap(value, i, group);
      if (on) for (var j = 0, m = on.length; j < m; ++j) {
        if ((o = on[j]).type === typename.type && o.name === typename.name) {
          this.removeEventListener(o.type, o.listener, o.capture);
          this.addEventListener(o.type, o.listener = listener, o.capture = capture);
          o.value = value;
          return;
        }
      }
      this.addEventListener(typename.type, listener, capture);
      o = {type: typename.type, name: typename.name, value: value, listener: listener, capture: capture};
      if (!on) this.__on = [o];
      else on.push(o);
    };
  }

  function selection_on(typename, value, capture) {
    var typenames = parseTypenames$1(typename + ""), i, n = typenames.length, t;

    if (arguments.length < 2) {
      var on = this.node().__on;
      if (on) for (var j = 0, m = on.length, o; j < m; ++j) {
        for (i = 0, o = on[j]; i < n; ++i) {
          if ((t = typenames[i]).type === o.type && t.name === o.name) {
            return o.value;
          }
        }
      }
      return;
    }

    on = value ? onAdd : onRemove;
    if (capture == null) capture = false;
    for (i = 0; i < n; ++i) this.each(on(typenames[i], value, capture));
    return this;
  }

  function customEvent(event1, listener, that, args) {
    var event0 = event;
    event1.sourceEvent = event;
    event = event1;
    try {
      return listener.apply(that, args);
    } finally {
      event = event0;
    }
  }

  function dispatchEvent(node, type, params) {
    var window = defaultView(node),
        event = window.CustomEvent;

    if (typeof event === "function") {
      event = new event(type, params);
    } else {
      event = window.document.createEvent("Event");
      if (params) event.initEvent(type, params.bubbles, params.cancelable), event.detail = params.detail;
      else event.initEvent(type, false, false);
    }

    node.dispatchEvent(event);
  }

  function dispatchConstant(type, params) {
    return function() {
      return dispatchEvent(this, type, params);
    };
  }

  function dispatchFunction(type, params) {
    return function() {
      return dispatchEvent(this, type, params.apply(this, arguments));
    };
  }

  function selection_dispatch(type, params) {
    return this.each((typeof params === "function"
        ? dispatchFunction
        : dispatchConstant)(type, params));
  }

  var root = [null];

  function Selection(groups, parents) {
    this._groups = groups;
    this._parents = parents;
  }

  Selection.prototype = {
    constructor: Selection,
    select: selection_select,
    selectAll: selection_selectAll,
    filter: selection_filter,
    data: selection_data,
    enter: selection_enter,
    exit: selection_exit,
    join: selection_join,
    merge: selection_merge,
    order: selection_order,
    sort: selection_sort,
    call: selection_call,
    nodes: selection_nodes,
    node: selection_node,
    size: selection_size,
    empty: selection_empty,
    each: selection_each,
    attr: selection_attr,
    style: selection_style,
    property: selection_property,
    classed: selection_classed,
    text: selection_text,
    html: selection_html,
    raise: selection_raise,
    lower: selection_lower,
    append: selection_append,
    insert: selection_insert,
    remove: selection_remove,
    clone: selection_clone,
    datum: selection_datum,
    on: selection_on,
    dispatch: selection_dispatch
  };

  function select(selector) {
    return typeof selector === "string"
        ? new Selection([[document.querySelector(selector)]], [document.documentElement])
        : new Selection([[selector]], root);
  }

  function sourceEvent() {
    var current = event, source;
    while (source = current.sourceEvent) current = source;
    return current;
  }

  function point(node, event) {
    var svg = node.ownerSVGElement || node;

    if (svg.createSVGPoint) {
      var point = svg.createSVGPoint();
      point.x = event.clientX, point.y = event.clientY;
      point = point.matrixTransform(node.getScreenCTM().inverse());
      return [point.x, point.y];
    }

    var rect = node.getBoundingClientRect();
    return [event.clientX - rect.left - node.clientLeft, event.clientY - rect.top - node.clientTop];
  }

  function mouse(node) {
    var event = sourceEvent();
    if (event.changedTouches) event = event.changedTouches[0];
    return point(node, event);
  }

  function touch(node, touches, identifier) {
    if (arguments.length < 3) identifier = touches, touches = sourceEvent().changedTouches;

    for (var i = 0, n = touches ? touches.length : 0, touch; i < n; ++i) {
      if ((touch = touches[i]).identifier === identifier) {
        return point(node, touch);
      }
    }

    return null;
  }

  var noop = {value: function() {}};

  function dispatch() {
    for (var i = 0, n = arguments.length, _ = {}, t; i < n; ++i) {
      if (!(t = arguments[i] + "") || (t in _) || /[\s.]/.test(t)) throw new Error("illegal type: " + t);
      _[t] = [];
    }
    return new Dispatch(_);
  }

  function Dispatch(_) {
    this._ = _;
  }

  function parseTypenames(typenames, types) {
    return typenames.trim().split(/^|\s+/).map(function(t) {
      var name = "", i = t.indexOf(".");
      if (i >= 0) name = t.slice(i + 1), t = t.slice(0, i);
      if (t && !types.hasOwnProperty(t)) throw new Error("unknown type: " + t);
      return {type: t, name: name};
    });
  }

  Dispatch.prototype = dispatch.prototype = {
    constructor: Dispatch,
    on: function(typename, callback) {
      var _ = this._,
          T = parseTypenames(typename + "", _),
          t,
          i = -1,
          n = T.length;

      // If no callback was specified, return the callback of the given type and name.
      if (arguments.length < 2) {
        while (++i < n) if ((t = (typename = T[i]).type) && (t = get(_[t], typename.name))) return t;
        return;
      }

      // If a type was specified, set the callback for the given type and name.
      // Otherwise, if a null callback was specified, remove callbacks of the given name.
      if (callback != null && typeof callback !== "function") throw new Error("invalid callback: " + callback);
      while (++i < n) {
        if (t = (typename = T[i]).type) _[t] = set(_[t], typename.name, callback);
        else if (callback == null) for (t in _) _[t] = set(_[t], typename.name, null);
      }

      return this;
    },
    copy: function() {
      var copy = {}, _ = this._;
      for (var t in _) copy[t] = _[t].slice();
      return new Dispatch(copy);
    },
    call: function(type, that) {
      if ((n = arguments.length - 2) > 0) for (var args = new Array(n), i = 0, n, t; i < n; ++i) args[i] = arguments[i + 2];
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    },
    apply: function(type, that, args) {
      if (!this._.hasOwnProperty(type)) throw new Error("unknown type: " + type);
      for (var t = this._[type], i = 0, n = t.length; i < n; ++i) t[i].value.apply(that, args);
    }
  };

  function get(type, name) {
    for (var i = 0, n = type.length, c; i < n; ++i) {
      if ((c = type[i]).name === name) {
        return c.value;
      }
    }
  }

  function set(type, name, callback) {
    for (var i = 0, n = type.length; i < n; ++i) {
      if (type[i].name === name) {
        type[i] = noop, type = type.slice(0, i).concat(type.slice(i + 1));
        break;
      }
    }
    if (callback != null) type.push({name: name, value: callback});
    return type;
  }

  function nopropagation() {
    event.stopImmediatePropagation();
  }

  function noevent() {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function nodrag(view) {
    var root = view.document.documentElement,
        selection = select(view).on("dragstart.drag", noevent, true);
    if ("onselectstart" in root) {
      selection.on("selectstart.drag", noevent, true);
    } else {
      root.__noselect = root.style.MozUserSelect;
      root.style.MozUserSelect = "none";
    }
  }

  function yesdrag(view, noclick) {
    var root = view.document.documentElement,
        selection = select(view).on("dragstart.drag", null);
    if (noclick) {
      selection.on("click.drag", noevent, true);
      setTimeout(function() { selection.on("click.drag", null); }, 0);
    }
    if ("onselectstart" in root) {
      selection.on("selectstart.drag", null);
    } else {
      root.style.MozUserSelect = root.__noselect;
      delete root.__noselect;
    }
  }

  function constant(x) {
    return function() {
      return x;
    };
  }

  function DragEvent(target, type, subject, id, active, x, y, dx, dy, dispatch) {
    this.target = target;
    this.type = type;
    this.subject = subject;
    this.identifier = id;
    this.active = active;
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this._ = dispatch;
  }

  DragEvent.prototype.on = function() {
    var value = this._.on.apply(this._, arguments);
    return value === this._ ? this : value;
  };

  // Ignore right-click, since that should open the context menu.
  function defaultFilter() {
    return !event.ctrlKey && !event.button;
  }

  function defaultContainer() {
    return this.parentNode;
  }

  function defaultSubject(d) {
    return d == null ? {x: event.x, y: event.y} : d;
  }

  function defaultTouchable() {
    return navigator.maxTouchPoints || ("ontouchstart" in this);
  }

  function drag() {
    var filter = defaultFilter,
        container = defaultContainer,
        subject = defaultSubject,
        touchable = defaultTouchable,
        gestures = {},
        listeners = dispatch("start", "drag", "end"),
        active = 0,
        mousedownx,
        mousedowny,
        mousemoving,
        touchending,
        clickDistance2 = 0;

    function drag(selection) {
      selection
          .on("mousedown.drag", mousedowned)
        .filter(touchable)
          .on("touchstart.drag", touchstarted)
          .on("touchmove.drag", touchmoved)
          .on("touchend.drag touchcancel.drag", touchended)
          .style("touch-action", "none")
          .style("-webkit-tap-highlight-color", "rgba(0,0,0,0)");
    }

    function mousedowned() {
      if (touchending || !filter.apply(this, arguments)) return;
      var gesture = beforestart("mouse", container.apply(this, arguments), mouse, this, arguments);
      if (!gesture) return;
      select(event.view).on("mousemove.drag", mousemoved, true).on("mouseup.drag", mouseupped, true);
      nodrag(event.view);
      nopropagation();
      mousemoving = false;
      mousedownx = event.clientX;
      mousedowny = event.clientY;
      gesture("start");
    }

    function mousemoved() {
      noevent();
      if (!mousemoving) {
        var dx = event.clientX - mousedownx, dy = event.clientY - mousedowny;
        mousemoving = dx * dx + dy * dy > clickDistance2;
      }
      gestures.mouse("drag");
    }

    function mouseupped() {
      select(event.view).on("mousemove.drag mouseup.drag", null);
      yesdrag(event.view, mousemoving);
      noevent();
      gestures.mouse("end");
    }

    function touchstarted() {
      if (!filter.apply(this, arguments)) return;
      var touches = event.changedTouches,
          c = container.apply(this, arguments),
          n = touches.length, i, gesture;

      for (i = 0; i < n; ++i) {
        if (gesture = beforestart(touches[i].identifier, c, touch, this, arguments)) {
          nopropagation();
          gesture("start");
        }
      }
    }

    function touchmoved() {
      var touches = event.changedTouches,
          n = touches.length, i, gesture;

      for (i = 0; i < n; ++i) {
        if (gesture = gestures[touches[i].identifier]) {
          noevent();
          gesture("drag");
        }
      }
    }

    function touchended() {
      var touches = event.changedTouches,
          n = touches.length, i, gesture;

      if (touchending) clearTimeout(touchending);
      touchending = setTimeout(function() { touchending = null; }, 500); // Ghost clicks are delayed!
      for (i = 0; i < n; ++i) {
        if (gesture = gestures[touches[i].identifier]) {
          nopropagation();
          gesture("end");
        }
      }
    }

    function beforestart(id, container, point, that, args) {
      var p = point(container, id), s, dx, dy,
          sublisteners = listeners.copy();

      if (!customEvent(new DragEvent(drag, "beforestart", s, id, active, p[0], p[1], 0, 0, sublisteners), function() {
        if ((event.subject = s = subject.apply(that, args)) == null) return false;
        dx = s.x - p[0] || 0;
        dy = s.y - p[1] || 0;
        return true;
      })) return;

      return function gesture(type) {
        var p0 = p, n;
        switch (type) {
          case "start": gestures[id] = gesture, n = active++; break;
          case "end": delete gestures[id], --active; // nobreak
          case "drag": p = point(container, id), n = active; break;
        }
        customEvent(new DragEvent(drag, type, s, id, n, p[0] + dx, p[1] + dy, p[0] - p0[0], p[1] - p0[1], sublisteners), sublisteners.apply, sublisteners, [type, that, args]);
      };
    }

    drag.filter = function(_) {
      return arguments.length ? (filter = typeof _ === "function" ? _ : constant(!!_), drag) : filter;
    };

    drag.container = function(_) {
      return arguments.length ? (container = typeof _ === "function" ? _ : constant(_), drag) : container;
    };

    drag.subject = function(_) {
      return arguments.length ? (subject = typeof _ === "function" ? _ : constant(_), drag) : subject;
    };

    drag.touchable = function(_) {
      return arguments.length ? (touchable = typeof _ === "function" ? _ : constant(!!_), drag) : touchable;
    };

    drag.on = function() {
      var value = listeners.on.apply(listeners, arguments);
      return value === listeners ? drag : value;
    };

    drag.clickDistance = function(_) {
      return arguments.length ? (clickDistance2 = (_ = +_) * _, drag) : Math.sqrt(clickDistance2);
    };

    return drag;
  }

  var orientation = {exports: {}};

  var twoProduct_1 = twoProduct$1;

  var SPLITTER = +(Math.pow(2, 27) + 1.0);

  function twoProduct$1(a, b, result) {
    var x = a * b;

    var c = SPLITTER * a;
    var abig = c - a;
    var ahi = c - abig;
    var alo = a - ahi;

    var d = SPLITTER * b;
    var bbig = d - b;
    var bhi = d - bbig;
    var blo = b - bhi;

    var err1 = x - (ahi * bhi);
    var err2 = err1 - (alo * bhi);
    var err3 = err2 - (ahi * blo);

    var y = alo * blo - err3;

    if(result) {
      result[0] = y;
      result[1] = x;
      return result
    }

    return [ y, x ]
  }

  var robustSum = linearExpansionSum;

  //Easy case: Add two scalars
  function scalarScalar$1(a, b) {
    var x = a + b;
    var bv = x - a;
    var av = x - bv;
    var br = b - bv;
    var ar = a - av;
    var y = ar + br;
    if(y) {
      return [y, x]
    }
    return [x]
  }

  function linearExpansionSum(e, f) {
    var ne = e.length|0;
    var nf = f.length|0;
    if(ne === 1 && nf === 1) {
      return scalarScalar$1(e[0], f[0])
    }
    var n = ne + nf;
    var g = new Array(n);
    var count = 0;
    var eptr = 0;
    var fptr = 0;
    var abs = Math.abs;
    var ei = e[eptr];
    var ea = abs(ei);
    var fi = f[fptr];
    var fa = abs(fi);
    var a, b;
    if(ea < fa) {
      b = ei;
      eptr += 1;
      if(eptr < ne) {
        ei = e[eptr];
        ea = abs(ei);
      }
    } else {
      b = fi;
      fptr += 1;
      if(fptr < nf) {
        fi = f[fptr];
        fa = abs(fi);
      }
    }
    if((eptr < ne && ea < fa) || (fptr >= nf)) {
      a = ei;
      eptr += 1;
      if(eptr < ne) {
        ei = e[eptr];
        ea = abs(ei);
      }
    } else {
      a = fi;
      fptr += 1;
      if(fptr < nf) {
        fi = f[fptr];
        fa = abs(fi);
      }
    }
    var x = a + b;
    var bv = x - a;
    var y = b - bv;
    var q0 = y;
    var q1 = x;
    var _x, _bv, _av, _br, _ar;
    while(eptr < ne && fptr < nf) {
      if(ea < fa) {
        a = ei;
        eptr += 1;
        if(eptr < ne) {
          ei = e[eptr];
          ea = abs(ei);
        }
      } else {
        a = fi;
        fptr += 1;
        if(fptr < nf) {
          fi = f[fptr];
          fa = abs(fi);
        }
      }
      b = q0;
      x = a + b;
      bv = x - a;
      y = b - bv;
      if(y) {
        g[count++] = y;
      }
      _x = q1 + x;
      _bv = _x - q1;
      _av = _x - _bv;
      _br = x - _bv;
      _ar = q1 - _av;
      q0 = _ar + _br;
      q1 = _x;
    }
    while(eptr < ne) {
      a = ei;
      b = q0;
      x = a + b;
      bv = x - a;
      y = b - bv;
      if(y) {
        g[count++] = y;
      }
      _x = q1 + x;
      _bv = _x - q1;
      _av = _x - _bv;
      _br = x - _bv;
      _ar = q1 - _av;
      q0 = _ar + _br;
      q1 = _x;
      eptr += 1;
      if(eptr < ne) {
        ei = e[eptr];
      }
    }
    while(fptr < nf) {
      a = fi;
      b = q0;
      x = a + b;
      bv = x - a;
      y = b - bv;
      if(y) {
        g[count++] = y;
      } 
      _x = q1 + x;
      _bv = _x - q1;
      _av = _x - _bv;
      _br = x - _bv;
      _ar = q1 - _av;
      q0 = _ar + _br;
      q1 = _x;
      fptr += 1;
      if(fptr < nf) {
        fi = f[fptr];
      }
    }
    if(q0) {
      g[count++] = q0;
    }
    if(q1) {
      g[count++] = q1;
    }
    if(!count) {
      g[count++] = 0.0;  
    }
    g.length = count;
    return g
  }

  var twoSum$1 = fastTwoSum;

  function fastTwoSum(a, b, result) {
  	var x = a + b;
  	var bv = x - a;
  	var av = x - bv;
  	var br = b - bv;
  	var ar = a - av;
  	if(result) {
  		result[0] = ar + br;
  		result[1] = x;
  		return result
  	}
  	return [ar+br, x]
  }

  var twoProduct = twoProduct_1;
  var twoSum = twoSum$1;

  var robustScale = scaleLinearExpansion;

  function scaleLinearExpansion(e, scale) {
    var n = e.length;
    if(n === 1) {
      var ts = twoProduct(e[0], scale);
      if(ts[0]) {
        return ts
      }
      return [ ts[1] ]
    }
    var g = new Array(2 * n);
    var q = [0.1, 0.1];
    var t = [0.1, 0.1];
    var count = 0;
    twoProduct(e[0], scale, q);
    if(q[0]) {
      g[count++] = q[0];
    }
    for(var i=1; i<n; ++i) {
      twoProduct(e[i], scale, t);
      var pq = q[1];
      twoSum(pq, t[0], q);
      if(q[0]) {
        g[count++] = q[0];
      }
      var a = t[1];
      var b = q[1];
      var x = a + b;
      var bv = x - a;
      var y = b - bv;
      q[1] = x;
      if(y) {
        g[count++] = y;
      }
    }
    if(q[1]) {
      g[count++] = q[1];
    }
    if(count === 0) {
      g[count++] = 0.0;
    }
    g.length = count;
    return g
  }

  var robustDiff = robustSubtract;

  //Easy case: Add two scalars
  function scalarScalar(a, b) {
    var x = a + b;
    var bv = x - a;
    var av = x - bv;
    var br = b - bv;
    var ar = a - av;
    var y = ar + br;
    if(y) {
      return [y, x]
    }
    return [x]
  }

  function robustSubtract(e, f) {
    var ne = e.length|0;
    var nf = f.length|0;
    if(ne === 1 && nf === 1) {
      return scalarScalar(e[0], -f[0])
    }
    var n = ne + nf;
    var g = new Array(n);
    var count = 0;
    var eptr = 0;
    var fptr = 0;
    var abs = Math.abs;
    var ei = e[eptr];
    var ea = abs(ei);
    var fi = -f[fptr];
    var fa = abs(fi);
    var a, b;
    if(ea < fa) {
      b = ei;
      eptr += 1;
      if(eptr < ne) {
        ei = e[eptr];
        ea = abs(ei);
      }
    } else {
      b = fi;
      fptr += 1;
      if(fptr < nf) {
        fi = -f[fptr];
        fa = abs(fi);
      }
    }
    if((eptr < ne && ea < fa) || (fptr >= nf)) {
      a = ei;
      eptr += 1;
      if(eptr < ne) {
        ei = e[eptr];
        ea = abs(ei);
      }
    } else {
      a = fi;
      fptr += 1;
      if(fptr < nf) {
        fi = -f[fptr];
        fa = abs(fi);
      }
    }
    var x = a + b;
    var bv = x - a;
    var y = b - bv;
    var q0 = y;
    var q1 = x;
    var _x, _bv, _av, _br, _ar;
    while(eptr < ne && fptr < nf) {
      if(ea < fa) {
        a = ei;
        eptr += 1;
        if(eptr < ne) {
          ei = e[eptr];
          ea = abs(ei);
        }
      } else {
        a = fi;
        fptr += 1;
        if(fptr < nf) {
          fi = -f[fptr];
          fa = abs(fi);
        }
      }
      b = q0;
      x = a + b;
      bv = x - a;
      y = b - bv;
      if(y) {
        g[count++] = y;
      }
      _x = q1 + x;
      _bv = _x - q1;
      _av = _x - _bv;
      _br = x - _bv;
      _ar = q1 - _av;
      q0 = _ar + _br;
      q1 = _x;
    }
    while(eptr < ne) {
      a = ei;
      b = q0;
      x = a + b;
      bv = x - a;
      y = b - bv;
      if(y) {
        g[count++] = y;
      }
      _x = q1 + x;
      _bv = _x - q1;
      _av = _x - _bv;
      _br = x - _bv;
      _ar = q1 - _av;
      q0 = _ar + _br;
      q1 = _x;
      eptr += 1;
      if(eptr < ne) {
        ei = e[eptr];
      }
    }
    while(fptr < nf) {
      a = fi;
      b = q0;
      x = a + b;
      bv = x - a;
      y = b - bv;
      if(y) {
        g[count++] = y;
      } 
      _x = q1 + x;
      _bv = _x - q1;
      _av = _x - _bv;
      _br = x - _bv;
      _ar = q1 - _av;
      q0 = _ar + _br;
      q1 = _x;
      fptr += 1;
      if(fptr < nf) {
        fi = -f[fptr];
      }
    }
    if(q0) {
      g[count++] = q0;
    }
    if(q1) {
      g[count++] = q1;
    }
    if(!count) {
      g[count++] = 0.0;  
    }
    g.length = count;
    return g
  }

  (function (module) {

  var twoProduct = twoProduct_1;
  var robustSum$1 = robustSum;
  var robustScale$1 = robustScale;
  var robustSubtract = robustDiff;

  var NUM_EXPAND = 5;

  var EPSILON     = 1.1102230246251565e-16;
  var ERRBOUND3   = (3.0 + 16.0 * EPSILON) * EPSILON;
  var ERRBOUND4   = (7.0 + 56.0 * EPSILON) * EPSILON;

  function cofactor(m, c) {
    var result = new Array(m.length-1);
    for(var i=1; i<m.length; ++i) {
      var r = result[i-1] = new Array(m.length-1);
      for(var j=0,k=0; j<m.length; ++j) {
        if(j === c) {
          continue
        }
        r[k++] = m[i][j];
      }
    }
    return result
  }

  function matrix(n) {
    var result = new Array(n);
    for(var i=0; i<n; ++i) {
      result[i] = new Array(n);
      for(var j=0; j<n; ++j) {
        result[i][j] = ["m", j, "[", (n-i-1), "]"].join("");
      }
    }
    return result
  }

  function sign(n) {
    if(n & 1) {
      return "-"
    }
    return ""
  }

  function generateSum(expr) {
    if(expr.length === 1) {
      return expr[0]
    } else if(expr.length === 2) {
      return ["sum(", expr[0], ",", expr[1], ")"].join("")
    } else {
      var m = expr.length>>1;
      return ["sum(", generateSum(expr.slice(0, m)), ",", generateSum(expr.slice(m)), ")"].join("")
    }
  }

  function determinant(m) {
    if(m.length === 2) {
      return [["sum(prod(", m[0][0], ",", m[1][1], "),prod(-", m[0][1], ",", m[1][0], "))"].join("")]
    } else {
      var expr = [];
      for(var i=0; i<m.length; ++i) {
        expr.push(["scale(", generateSum(determinant(cofactor(m, i))), ",", sign(i), m[0][i], ")"].join(""));
      }
      return expr
    }
  }

  function orientation(n) {
    var pos = [];
    var neg = [];
    var m = matrix(n);
    var args = [];
    for(var i=0; i<n; ++i) {
      if((i&1)===0) {
        pos.push.apply(pos, determinant(cofactor(m, i)));
      } else {
        neg.push.apply(neg, determinant(cofactor(m, i)));
      }
      args.push("m" + i);
    }
    var posExpr = generateSum(pos);
    var negExpr = generateSum(neg);
    var funcName = "orientation" + n + "Exact";
    var code = ["function ", funcName, "(", args.join(), "){var p=", posExpr, ",n=", negExpr, ",d=sub(p,n);\
return d[d.length-1];};return ", funcName].join("");
    var proc = new Function("sum", "prod", "scale", "sub", code);
    return proc(robustSum$1, twoProduct, robustScale$1, robustSubtract)
  }

  var orientation3Exact = orientation(3);
  var orientation4Exact = orientation(4);

  var CACHED = [
    function orientation0() { return 0 },
    function orientation1() { return 0 },
    function orientation2(a, b) { 
      return b[0] - a[0]
    },
    function orientation3(a, b, c) {
      var l = (a[1] - c[1]) * (b[0] - c[0]);
      var r = (a[0] - c[0]) * (b[1] - c[1]);
      var det = l - r;
      var s;
      if(l > 0) {
        if(r <= 0) {
          return det
        } else {
          s = l + r;
        }
      } else if(l < 0) {
        if(r >= 0) {
          return det
        } else {
          s = -(l + r);
        }
      } else {
        return det
      }
      var tol = ERRBOUND3 * s;
      if(det >= tol || det <= -tol) {
        return det
      }
      return orientation3Exact(a, b, c)
    },
    function orientation4(a,b,c,d) {
      var adx = a[0] - d[0];
      var bdx = b[0] - d[0];
      var cdx = c[0] - d[0];
      var ady = a[1] - d[1];
      var bdy = b[1] - d[1];
      var cdy = c[1] - d[1];
      var adz = a[2] - d[2];
      var bdz = b[2] - d[2];
      var cdz = c[2] - d[2];
      var bdxcdy = bdx * cdy;
      var cdxbdy = cdx * bdy;
      var cdxady = cdx * ady;
      var adxcdy = adx * cdy;
      var adxbdy = adx * bdy;
      var bdxady = bdx * ady;
      var det = adz * (bdxcdy - cdxbdy) 
              + bdz * (cdxady - adxcdy)
              + cdz * (adxbdy - bdxady);
      var permanent = (Math.abs(bdxcdy) + Math.abs(cdxbdy)) * Math.abs(adz)
                    + (Math.abs(cdxady) + Math.abs(adxcdy)) * Math.abs(bdz)
                    + (Math.abs(adxbdy) + Math.abs(bdxady)) * Math.abs(cdz);
      var tol = ERRBOUND4 * permanent;
      if ((det > tol) || (-det > tol)) {
        return det
      }
      return orientation4Exact(a,b,c,d)
    }
  ];

  function slowOrient(args) {
    var proc = CACHED[args.length];
    if(!proc) {
      proc = CACHED[args.length] = orientation(args.length);
    }
    return proc.apply(undefined, args)
  }

  function generateOrientationProc() {
    while(CACHED.length <= NUM_EXPAND) {
      CACHED.push(orientation(CACHED.length));
    }
    var args = [];
    var procArgs = ["slow"];
    for(var i=0; i<=NUM_EXPAND; ++i) {
      args.push("a" + i);
      procArgs.push("o" + i);
    }
    var code = [
      "function getOrientation(", args.join(), "){switch(arguments.length){case 0:case 1:return 0;"
    ];
    for(var i=2; i<=NUM_EXPAND; ++i) {
      code.push("case ", i, ":return o", i, "(", args.slice(0, i).join(), ");");
    }
    code.push("}var s=new Array(arguments.length);for(var i=0;i<arguments.length;++i){s[i]=arguments[i]};return slow(s);}return getOrientation");
    procArgs.push(code.join(""));

    var proc = Function.apply(undefined, procArgs);
    module.exports = proc.apply(undefined, [slowOrient].concat(CACHED));
    for(var i=0; i<=NUM_EXPAND; ++i) {
      module.exports[i] = CACHED[i];
    }
  }

  generateOrientationProc();
  }(orientation));

  var robustPnp = robustPointInPolygon;

  var orient = orientation.exports;

  function robustPointInPolygon(vs, point) {
    var x = point[0];
    var y = point[1];
    var n = vs.length;
    var inside = 1;
    var lim = n;
    for(var i = 0, j = n-1; i<lim; j=i++) {
      var a = vs[i];
      var b = vs[j];
      var yi = a[1];
      var yj = b[1];
      if(yj < yi) {
        if(yj < y && y < yi) {
          var s = orient(a, b, point);
          if(s === 0) {
            return 0
          } else {
            inside ^= (0 < s)|0;
          }
        } else if(y === yi) {
          var c = vs[(i+1)%n];
          var yk = c[1];
          if(yi < yk) {
            var s = orient(a, b, point);
            if(s === 0) {
              return 0
            } else {
              inside ^= (0 < s)|0;
            }
          }
        }
      } else if(yi < yj) {
        if(yi < y && y < yj) {
          var s = orient(a, b, point);
          if(s === 0) {
            return 0
          } else {
            inside ^= (s < 0)|0;
          }
        } else if(y === yi) {
          var c = vs[(i+1)%n];
          var yk = c[1];
          if(yk < yi) {
            var s = orient(a, b, point);
            if(s === 0) {
              return 0
            } else {
              inside ^= (s < 0)|0;
            }
          }
        }
      } else if(y === yi) {
        var x0 = Math.min(a[0], b[0]);
        var x1 = Math.max(a[0], b[0]);
        if(i === 0) {
          while(j>0) {
            var k = (j+n-1)%n;
            var p = vs[k];
            if(p[1] !== y) {
              break
            }
            var px = p[0];
            x0 = Math.min(x0, px);
            x1 = Math.max(x1, px);
            j = k;
          }
          if(j === 0) {
            if(x0 <= x && x <= x1) {
              return 0
            }
            return 1 
          }
          lim = j+1;
        }
        var y0 = vs[(j+n-1)%n][1];
        while(i+1<lim) {
          var p = vs[i+1];
          if(p[1] !== y) {
            break
          }
          var px = p[0];
          x0 = Math.min(x0, px);
          x1 = Math.max(x1, px);
          i += 1;
        }
        if(x0 <= x && x <= x1) {
          return 0
        }
        var y1 = vs[(i+1)%n][1];
        if(x < x0 && (y0 < y !== y1 < y)) {
          inside ^= 1;
        }
      }
    }
    return 2 * inside - 1
  }

  function lasso() {

      var items =[],
          closePathDistance = 75,
          closePathSelect = true,
          isPathClosed = false,
          hoverSelect = true,
          targetArea,
          on = {start:function(){}, draw: function(){}, end: function(){}};

      // Function to execute on call
      function lasso(_this) {

          // add a new group for the lasso
          var g = _this.append("g")
              .attr("class","lasso");
          
          // add the drawn path for the lasso
          var dyn_path = g.append("path")
              .attr("class","drawn");
          
          // add a closed path
          var close_path = g.append("path")
              .attr("class","loop_close");
          
          // add an origin node
          var origin_node = g.append("circle")
              .attr("class","origin");

          // The transformed lasso path for rendering
          var tpath;

          // The lasso origin for calculations
          var origin;

          // The transformed lasso origin for rendering
          var torigin;

          // Store off coordinates drawn
          var drawnCoords;

           // Apply drag behaviors
          var dragAction = drag()
              .on("start",dragstart)
              .on("drag",dragmove)
              .on("end",dragend);

          // Call drag
          targetArea.call(dragAction);

          function dragstart() {
              // Init coordinates
              drawnCoords = [];

              // Initialize paths
              tpath = "";
              dyn_path.attr("d",null);
              close_path.attr("d",null);

              // Set every item to have a false selection and reset their center point and counters
              items.nodes().forEach(function(e) {            
                  e.__lasso.possible = false;
                  e.__lasso.selected = false;
                  e.__lasso.hoverSelect = false;
                  e.__lasso.loopSelect = false;
                  
                  var box = e.getBoundingClientRect();
                  e.__lasso.lassoPoint = [Math.round(box.left + box.width/2),Math.round(box.top + box.height/2)];
              });

              // if hover is on, add hover function
              if(hoverSelect) {
                  items.on("mouseover.lasso",function() {
                      // if hovered, change lasso selection attribute to true
                      this.__lasso.hoverSelect = true;
                  });
              }

              // Run user defined start function
              on.start();
          }

          function dragmove() {
              // Get mouse position within body, used for calculations
              var x,y;
              if(event.sourceEvent.type === "touchmove") {
                  x = event.sourceEvent.touches[0].clientX;
                  y = event.sourceEvent.touches[0].clientY;
              }
              else {
                  x = event.sourceEvent.clientX;
                  y = event.sourceEvent.clientY;
              }
              

              // Get mouse position within drawing area, used for rendering
              var tx = mouse(this)[0];
              var ty = mouse(this)[1];

              // Initialize the path or add the latest point to it
              if (tpath==="") {
                  tpath = tpath + "M " + tx + " " + ty;
                  origin = [x,y];
                  torigin = [tx,ty];
                  // Draw origin node
                  origin_node
                      .attr("cx",tx)
                      .attr("cy",ty)
                      .attr("r",7)
                      .attr("display",null);
              }
              else {
                  tpath = tpath + " L " + tx + " " + ty;
              }

              drawnCoords.push([x,y]);

              // Calculate the current distance from the lasso origin
              var distance = Math.sqrt(Math.pow(x-origin[0],2)+Math.pow(y-origin[1],2));

              // Set the closed path line
              var close_draw_path = "M " + tx + " " + ty + " L " + torigin[0] + " " + torigin[1];

              // Draw the lines
              dyn_path.attr("d",tpath);

              close_path.attr("d",close_draw_path);

              // Check if the path is closed
              isPathClosed = distance<=closePathDistance ? true : false;

              // If within the closed path distance parameter, show the closed path. otherwise, hide it
              if(isPathClosed && closePathSelect) {
                  close_path.attr("display",null);
              }
              else {
                  close_path.attr("display","none");
              }

              items.nodes().forEach(function(n) {
                  n.__lasso.loopSelect = (isPathClosed && closePathSelect) ? (robustPnp(drawnCoords,n.__lasso.lassoPoint) < 1) : false; 
                  n.__lasso.possible = n.__lasso.hoverSelect || n.__lasso.loopSelect; 
              });

              on.draw();
          }

          function dragend() {
              // Remove mouseover tagging function
              items.on("mouseover.lasso",null);

              items.nodes().forEach(function(n) {
                  n.__lasso.selected = n.__lasso.possible;
                  n.__lasso.possible = false;
              });

              // Clear lasso
              dyn_path.attr("d",null);
              close_path.attr("d",null);
              origin_node.attr("display","none");

              // Run user defined end function
              on.end();
          }
      }

      // Set or get list of items for lasso to select
      lasso.items  = function(_) {
          if (!arguments.length) return items;
          items = _;
          var nodes = items.nodes();
          nodes.forEach(function(n) {
              n.__lasso = {
                  "possible": false,
                  "selected": false
              };
          });
          return lasso;
      };

      // Return possible items
      lasso.possibleItems = function() {
          return items.filter(function() {
              return this.__lasso.possible;
          });
      };

      // Return selected items
      lasso.selectedItems = function() {
          return items.filter(function() {
              return this.__lasso.selected;
          });
      };

      // Return not possible items
      lasso.notPossibleItems = function() {
          return items.filter(function() {
              return !this.__lasso.possible;
          });
      };

      // Return not selected items
      lasso.notSelectedItems = function() {
          return items.filter(function() {
              return !this.__lasso.selected;
          });
      };

      // Distance required before path auto closes loop
      lasso.closePathDistance  = function(_) {
          if (!arguments.length) return closePathDistance;
          closePathDistance = _;
          return lasso;
      };

      // Option to loop select or not
      lasso.closePathSelect = function(_) {
          if (!arguments.length) return closePathSelect;
          closePathSelect = _===true ? true : false;
          return lasso;
      };

      // Not sure what this is for
      lasso.isPathClosed = function(_) {
          if (!arguments.length) return isPathClosed;
          isPathClosed = _===true ? true : false;
          return lasso;
      };

      // Option to select on hover or not
      lasso.hoverSelect = function(_) {
          if (!arguments.length) return hoverSelect;
          hoverSelect = _===true ? true : false;
          return lasso;
      };

      // Events
      lasso.on = function(type,_) {
          if(!arguments.length) return on;
          if(arguments.length===1) return on[type];
          var types = ["start","draw","end"];
          if(types.indexOf(type)>-1) {
              on[type] = _;
          }
          return lasso;
      };

      // Area where lasso can be triggered from
      lasso.targetArea = function(_) {
          if(!arguments.length) return targetArea;
          targetArea = _;
          return lasso;
      };


      
      return lasso;
  }

  exports.lasso = lasso;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
