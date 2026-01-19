;;;; src/models.lisp

(in-package #:meta-library-search)

(defstruct library-result
  "Represents a single search result from a library."
  (title nil :type (or null string))
  (author nil :type (or null string))
  (description nil :type (or null string))
  (publish-date nil :type (or null string))
  (link nil :type (or null string))
  (image-url nil :type (or null string))
  (library nil :type (or null string))
  (availability nil :type (or null string)))
