;;;; meta-library-search.asd
;;;;
;;;; ASDF system definition for the meta-library search project.
;;;; This file tells Common Lisp how to load, compile, and organize your project.

(asdf:defsystem #:meta-library-search
  :description "Search for volumes across multiple Boston-area libraries"
  :author "Sam"
  :license "MIT"
  :version "0.1.0"

  ;; Dependencies - libraries your project needs
  ;; These will be automatically loaded via Quicklisp
  :depends-on (#:drakma           ; Battle-tested HTTP client
               #:plump            ; HTML/XML parser (lenient, good for messy HTML)
               #:jonathan         ; Fast JSON parser
               #:cl-ppcre         ; Perl-compatible regex
               #:str)             ; Modern string utilities

  ;; Serial means files are loaded in order (important in CL!)
  :serial t

  ;; Components define your source files and their load order
  :components ((:file "package")                    ; Package definitions first
               (:module "src"
                :serial t
                :components ((:file "models")       ; Data structures
                             (:module "queriers"
                              :serial t
                              :components ((:file "base")       ; Shared querier code
                                           (:file "bpl")        ; BPL querier
                                           (:file "athenaeum"))) ; Athenaeum querier
                             (:file "main"))))      ; Entry point

  ;; Optional: define how to run your program
  :in-order-to ((test-op (test-op #:meta-library-search/tests))))

;; Separate test system (Common Lisp best practice)
(asdf:defsystem #:meta-library-search/tests
  :description "Test suite for meta-library-search"
  :depends-on (#:meta-library-search
               #:fiveam)          ; Popular testing framework
  :components ((:module "tests"
                :serial t
                :components ((:file "package")
                             (:file "main-tests"))))
  :perform (test-op (o c) (symbol-call :fiveam :run! :meta-library-search-tests)))
