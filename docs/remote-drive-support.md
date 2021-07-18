# Remote drive

## Resource
We need to fetch and upload resource by it hash id

## Linked data
Client needs to synchronise all the linked data files with remote dries.
Linked data in json ld are highly compressive so they could be merged together as an array of linked data objects and then compressed into a zip file.

To effectively synchronise all data we would need to have either 
- batch fetch files modified since last synchronisation
- one by one fetch files modified since last synchronisation but with
  option to merge linked data into single file and remove old duplicates that were used to merge



