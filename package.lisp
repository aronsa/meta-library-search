;;;; package.lisp
;;;;
;;;; Package definitions for meta-library-search.
;;;; This must be loaded first - it defines the namespaces we'll use throughout the project.

(defpackage #:meta-library-search
  "Main package for the meta-library search application."

  ;; Import symbols from other packages we depend on
  ;; This makes them available without prefixes in our code
  (:use #:cl)  ; Common Lisp standard library

  ;; We could also import specific symbols from dependencies:
  ;; (:import-from #:drakma #:http-request)
  ;; Trade-off: explicit imports vs. using prefixes like drakma:http-request
  ;; Using prefixes is more common in CL - makes dependencies clear at call sites

  ;; Export symbols that other packages/users can access
  ;; These form your public API
  (:export #:search-libraries       ; Main entry point
           #:library-result          ; Data structure
           #:make-library-result     ; Constructor
           #:result-title            ; Accessors...
           #:result-author
           #:result-description
           #:result-publish-date
           #:result-link
           #:result-image-url
           #:result-library))

;; Note: We could create separate packages for queriers:
;; (defpackage #:meta-library-search.queriers.bpl ...)
;; Trade-off: More packages = better encapsulation, but adds complexity
;; For a project this size, one package is cleaner
